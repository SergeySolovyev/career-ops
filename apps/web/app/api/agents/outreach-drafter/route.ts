/**
 * POST /api/agents/outreach-drafter
 *
 * Вызов Outreach Drafter Agent через HTTP (для будущего admin-дашборда +
 * как альтернатива CLI scripts/draft-outreach.ts).
 *
 * Auth: founder-only (для MVP — проверка ADMIN_EMAILS env var).
 * Rate limit: 30/min — outreach обычно делается батчами 30-50 за раз.
 *
 * Request body:
 *   { targets: OutreachTarget[] }
 *
 * Response:
 *   200: { ok: true, drafts: [ { recipient, body, ... } | { error, recipient } ] }
 *   401: { error: 'Unauthorized' } (если не founder)
 *   400: { error: 'targets must be array' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import {
  draftOutreachBatch,
  type OutreachTarget,
} from '@/lib/agents/outreach-drafter'

export const runtime = 'nodejs'
export const maxDuration = 60

// ADMIN_EMAILS — env, через запятую. founder-only endpoint.
function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden — founder-only endpoint' },
        { status: 403 },
      )
    }

    const limited = await checkRateLimit(req, RATE_LIMITS.apply, user.id)
    if (limited) return limited

    const body = (await req.json()) as { targets?: OutreachTarget[] }
    if (!Array.isArray(body.targets) || body.targets.length === 0) {
      return NextResponse.json(
        { error: 'targets must be non-empty array' },
        { status: 400 },
      )
    }
    if (body.targets.length > 50) {
      return NextResponse.json(
        { error: 'max 50 targets per request — split into batches' },
        { status: 400 },
      )
    }

    const drafts = await draftOutreachBatch(body.targets)

    return NextResponse.json({
      ok: true,
      count: drafts.length,
      drafts,
    })
  } catch (e: any) {
    console.error('[/api/agents/outreach-drafter] error', e?.message ?? e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
