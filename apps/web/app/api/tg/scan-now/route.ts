/**
 * POST /api/tg/scan-now
 * Manual single-user scan trigger (button in /matches).
 * Delegates to runScanForUser() in lib/tg-scan-core.
 */

import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { runScanForUser } from '@/lib/tg-scan-core'

// Vercel limit: 60s for hobby, 300s for pro. Scan typically <30s.
export const maxDuration = 60

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'supabase_off' }, { status: 503 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'no_anthropic_key' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const report = await runScanForUser(supabase as any, {
      userId: user.id,
      apiKey,
    })

    if (report.blockedByQuota) {
      return NextResponse.json({
        ok: false,
        blockedByQuota: true,
        monthSpend: report.monthSpend,
        message: 'Превышен месячный лимит на AI-обработку. Сбросится через 30 дней.',
      })
    }

    return NextResponse.json({ ok: true, report })
  } catch (e: any) {
    console.error('[tg/scan-now] fatal', e)
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'unknown' },
      { status: 500 },
    )
  }
}
