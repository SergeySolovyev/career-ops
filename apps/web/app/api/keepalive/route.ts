import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

/**
 * Keepalive ping — runs hourly via Vercel cron. Performs trivial Supabase
 * SELECT to prevent Free-tier 7-day-inactivity auto-pause.
 *
 * Free tier idle policy: project pauses if NO database activity for 7 days.
 * Pre-launch we ran into this exact issue multiple times. This cron costs
 * ~$0 (1 query/hour, well under Free tier quotas).
 *
 * Authentication: Bearer CRON_SECRET header (Vercel cron injects this
 * automatically when the route is registered in vercel.json crons).
 */

// Force Node.js runtime — Supabase server client needs node:crypto
export const runtime = 'nodejs'

export async function GET(req: Request) {
  // Vercel cron auth check
  const authHeader = req.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: 'supabase_not_configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    // Trivial query against an existing public table — uses RLS so anon
    // sees 0 rows, but the query itself counts as "activity" against
    // Supabase idle clock.
    const { count, error } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.error('[keepalive] supabase error', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      user_profiles_count: count ?? 0,
    })
  } catch (e: any) {
    console.error('[keepalive] handler error', e)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
