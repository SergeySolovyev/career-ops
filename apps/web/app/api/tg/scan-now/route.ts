/**
 * POST /api/tg/scan-now
 * Manual single-user scan trigger (button in /matches).
 * Delegates to runScanForUser() in lib/tg-scan-core.
 */

import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { runScanForUser } from '@/lib/tg-scan-core'

// Defensive: tg-worker.ts uses node:crypto for HMAC; edge runtime would break it.
export const runtime = 'nodejs'

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

  // Graceful gate: TG worker is a separate process on a DigitalOcean droplet
  // (uses MTProto user-account session — can't run inside Vercel function).
  // Until WORKER_BASE_URL + WORKER_SHARED_SECRET are set, return a friendly
  // 503 so the UI can show "Telegram-каналы скоро" instead of crashing.
  if (!process.env.WORKER_BASE_URL || !process.env.WORKER_SHARED_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'tg_worker_unavailable',
        message: 'Поиск по Telegram-каналам скоро будет включён. Пока сканируем только hh.ru.',
      },
      { status: 503 },
    )
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
