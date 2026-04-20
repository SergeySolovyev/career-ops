/**
 * GET /api/telegram/me
 *
 * Returns the public info about our Telegram bot (username, display name).
 * Safe to be public — bot username is not secret; it's how users find the bot.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 503 })
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' })
    const j = await r.json()
    if (!j?.ok || !j.result) {
      return NextResponse.json({ error: j?.description || 'getMe failed' }, { status: 502 })
    }
    const b = j.result
    return NextResponse.json({
      username: b.username,
      name: b.first_name,
      link: `https://t.me/${b.username}`,
      can_join_groups: b.can_join_groups,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal' }, { status: 500 })
  }
}
