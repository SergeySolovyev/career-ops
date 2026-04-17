import { NextResponse } from 'next/server'

// GET /api/telegram/setup?url=https://careerpilot.vercel.app
// Настраивает webhook для Telegram-бота
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const baseUrl = searchParams.get('url') || process.env.NEXT_PUBLIC_APP_URL

  if (!baseUrl) {
    return NextResponse.json({ error: 'Provide ?url=https://... or set NEXT_PUBLIC_APP_URL' }, { status: 400 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 500 })
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message'],
    }),
  })

  const data = await res.json()

  // Также установим команды бота
  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'Начать работу' },
        { command: 'status', description: 'Статистика поиска' },
        { command: 'top', description: 'Топ-5 вакансий' },
        { command: 'help', description: 'Справка' },
      ],
    }),
  })

  return NextResponse.json({ webhookUrl, telegram_response: data })
}
