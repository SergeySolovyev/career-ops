/**
 * POST /api/tg/validate    Body: { username: string }
 * Proxies to MTProto worker /tg/validate to verify channel exists + has recent posts.
 * Returns { ok, exists, isPublic, lastPostUnix, postsLast30d }.
 *
 * Used by Settings UI when user adds a channel — gives immediate feedback
 * "канал жив, последний пост 2 часа назад" vs "канал не найден".
 */

import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { tgWorkerValidate } from '@/lib/tg-worker'

export const runtime = 'nodejs'

// Telegram allows: starts with letter or digit, 5-32 chars, [a-zA-Z0-9_]
const USERNAME_RE = /^[a-z0-9][a-z0-9_]{4,31}$/i

function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'supabase_off' }, { status: 503 })
  }

  // Auth — anyone can validate but only authed users matter (rate-limit hint)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const username = normalizeUsername(String(body?.username ?? ''))
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_username', hint: 'Allowed: a-z, 0-9, _, length 4-32' },
        { status: 400 },
      )
    }

    try {
      const result = await tgWorkerValidate({ username })

      // Best-effort: store the validation message but DON'T toggle status here.
      // Status changes must come from actual scan attempts (tg-scan-core),
      // not from the user clicking "check" repeatedly.
      const validationError =
        result.exists && result.isPublic
          ? null
          : (result.error ?? 'channel_unavailable')
      await supabase
        .from('tg_channels')
        .update({ validation_error: validationError })
        .eq('user_id', user.id)
        .eq('channel_username', username)

      return NextResponse.json({ ok: true, ...result })
    } catch (e: any) {
      const msg = e?.message ?? 'worker_error'
      return NextResponse.json(
        { ok: false, error: msg, status: e?.status ?? 502 },
        { status: 502 },
      )
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 })
  }
}
