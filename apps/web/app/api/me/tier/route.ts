import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { resolveTierState } from '@/lib/tier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/me/tier
 *
 * Returns the current user's tier + quota state. Used by client components
 * (matches grid, chat composer) to render "Pro only" badges and the
 * remaining-quota counter.
 *
 * Auth: required. Anonymous callers get 401 — never leak tier info.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const state = await resolveTierState(supabase, user.id)
    return NextResponse.json(state, {
      headers: {
        // Short cache — quota changes after every scan, but we don't need
        // sub-second freshness. Per-user; never share across users.
        'Cache-Control': 'private, max-age=15',
      },
    })
  } catch (e) {
    console.error('[api/me/tier] error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
