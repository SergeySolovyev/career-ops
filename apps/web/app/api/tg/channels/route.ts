/**
 * GET    /api/tg/channels         List the user's Telegram channels (defaults + custom).
 * POST   /api/tg/channels         Add a channel.    Body: { username: string }
 * DELETE /api/tg/channels?u=name  Remove a channel.
 *
 * Channel usernames are normalized: stripped of @, '/' and t.me/ prefix; lowercased.
 * Auto-seeds 10 default channels on first call if user has none.
 */

import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

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

async function ensureSeeded(supabase: any, userId: string) {
  // Check user_profiles.tg_seeded_at — prevents re-seeding if user deleted defaults
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tg_seeded_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (profile?.tg_seeded_at) return

  // Call the SQL helper installed by migration 003 (idempotent on tg_channels)
  await supabase.rpc('tg_seed_default_channels', { p_user_id: userId })
  // Mark seeded so we never auto-seed again
  await supabase
    .from('user_profiles')
    .update({ tg_seeded_at: new Date().toISOString() })
    .eq('user_id', userId)
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ channels: [], reason: 'supabase_off' })
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    await ensureSeeded(supabase, user.id)

    const { data, error } = await supabase
      .from('tg_channels')
      .select('id, channel_username, is_default, status, last_parsed_at, validation_error')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('channel_username', { ascending: true })

    if (error) throw error
    return NextResponse.json({ channels: data ?? [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'supabase_off' }, { status: 503 })
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const username = normalizeUsername(String(body?.username ?? ''))
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: 'invalid_username' }, { status: 400 })
    }

    const { error } = await supabase
      .from('tg_channels')
      .upsert(
        {
          user_id: user.id,
          channel_username: username,
          is_default: false,
          status: 'active',
        },
        { onConflict: 'user_id,channel_username' },
      )

    if (error) throw error
    return NextResponse.json({ ok: true, username })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'supabase_off' }, { status: 503 })
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const username = normalizeUsername(url.searchParams.get('u') ?? '')
    if (!username) {
      return NextResponse.json({ error: 'missing_username' }, { status: 400 })
    }

    const { error } = await supabase
      .from('tg_channels')
      .delete()
      .eq('user_id', user.id)
      .eq('channel_username', username)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown' }, { status: 500 })
  }
}
