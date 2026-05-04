/**
 * GET /api/tg/scan-all
 * Cron entrypoint (vercel.json hourly schedule).
 * Enumerates active users (those who have at least one active tg_channel +
 * a CV uploaded) and runs runScanForUser() for up to N of them per call,
 * starting with users whose channels were parsed least recently.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header (Vercel cron sets this).
 * Or `?dry=1` query param for inspection without writes.
 *
 * Hard caps:
 *   - 5 users per single invocation (total 5 × ~30s ≤ 150s; Vercel limit 300s on Pro)
 *   - Skips users whose monthly cost > $3
 *
 * Idempotency: each runScanForUser is independent + tracked by tg_channels.last_message_id
 * so re-runs are safe (no double-eval same message).
 */

import { NextResponse } from 'next/server'
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin'
import { runScanForUser } from '@/lib/tg-scan-core'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_USERS_PER_INVOCATION = 5
const MAX_CHANNELS_PER_USER = 25 // assume ≤25 channels/user — see NIT 22 rationale

export async function GET(req: Request) {
  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'

  // Auth: Vercel cron sends `Authorization: Bearer <CRON_SECRET>`
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[scan-all] CRON_SECRET missing in production — refusing to run')
      return NextResponse.json(
        { error: 'cron_secret_required_in_prod' },
        { status: 503 },
      )
    }
    console.warn('[scan-all] CRON_SECRET not set — open auth in non-prod env')
  } else {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'no_anthropic_key' }, { status: 503 })
  }

  const admin = createAdminClient()

  // Find users with at least one active channel, ordered by least-recently parsed.
  // Over-fetch by MAX_CHANNELS_PER_USER to ensure we get N distinct users even
  // if the top user has 25 channels filling the result set.
  const { data: candidateRows, error } = await admin
    .from('tg_channels')
    .select('user_id, last_parsed_at')
    .eq('status', 'active')
    .order('last_parsed_at', { ascending: true, nullsFirst: true })
    .limit(MAX_USERS_PER_INVOCATION * MAX_CHANNELS_PER_USER)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Dedup user_id, preserving order (oldest parsed first)
  const userIds: string[] = []
  const seen = new Set<string>()
  for (const r of candidateRows ?? []) {
    const uid = (r as any).user_id as string
    if (!seen.has(uid)) {
      seen.add(uid)
      userIds.push(uid)
      if (userIds.length >= MAX_USERS_PER_INVOCATION) break
    }
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldScan: userIds.length,
      userIds,
    })
  }

  const results: { userId: string; report: any; error?: string }[] = []

  for (const userId of userIds) {
    try {
      // validateUser: cron path uses admin client → enforce user_id exists in user_profiles
      const report = await runScanForUser(admin as any, {
        userId,
        apiKey,
        validateUser: true,
      })
      results.push({ userId, report })
    } catch (e: any) {
      results.push({
        userId,
        report: null,
        error: e?.message ?? 'unknown',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    scannedUsers: results.length,
    results,
  })
}
