import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

// Telegram Bot API helper
async function sendTelegramMessage(chatId: number | string, text: string, parseMode = 'HTML') {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  })
}

// Load pipeline stats
function getStats() {
  try {
    const evalPath = join(process.cwd(), 'data', 'auto-eval-log.json')
    const outreachPath = join(process.cwd(), 'data', 'outreach.json')
    const evalLog = JSON.parse(readFileSync(evalPath, 'utf-8'))
    const outreach = JSON.parse(readFileSync(outreachPath, 'utf-8'))

    const entries = Object.entries(evalLog.evaluated || {}) as [string, any][]
    const records = outreach.records || []

    const found = entries.length
    const recommended = entries.filter(([, v]) => ['apply', 'maybe'].includes(v.status)).length
    const applied = records.filter((r: any) => ['sent', 'delivered', 'replied'].includes(r.status)).length
    const scores = entries.filter(([, v]) => v.score > 0).map(([, v]) => v.score as number)
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0'

    // Top 3 vacancies
    const top = entries
      .filter(([, v]) => v.status === 'apply')
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3)
      .map(([url, v]) => {
        const name = (v.report || '').replace('.md', '').replace(/^\d+-/, '').replace(/-/g, ' ') || 'Unknown'
        return `  ${v.score}/5 — ${name}`
      })
      .join('\n')

    return { found, recommended, applied, avgScore, top }
  } catch {
    return null
  }
}

// Handle incoming Telegram webhook updates
export async function POST(req: Request) {
  try {
    const update = await req.json()
    const message = update.message

    if (!message?.text || !message.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim()

    // Command: /start
    if (text === '/start') {
      await sendTelegramMessage(chatId, [
        '<b>CareerPilot Bot</b>',
        '',
        'AI-платформа автоматизации поиска работы.',
        '',
        '<b>Команды:</b>',
        '/status — статистика пайплайна',
        '/top — топ вакансии (AI-скор 4.0+)',
        '/help — список команд',
        '',
        'Или просто напишите вопрос — AI-советник ответит!',
      ].join('\n'))
      return NextResponse.json({ ok: true })
    }

    // Command: /status
    if (text === '/status') {
      const stats = getStats()
      if (!stats) {
        await sendTelegramMessage(chatId, 'Данные пайплайна недоступны.')
        return NextResponse.json({ ok: true })
      }
      await sendTelegramMessage(chatId, [
        '<b>CareerPilot — Статус</b>',
        '',
        `Обработано вакансий: <b>${stats.found}</b>`,
        `Рекомендовано (apply/maybe): <b>${stats.recommended}</b>`,
        `Откликов отправлено: <b>${stats.applied}</b>`,
        `Средний AI-скор: <b>${stats.avgScore}</b>`,
      ].join('\n'))
      return NextResponse.json({ ok: true })
    }

    // Command: /top
    if (text === '/top') {
      const stats = getStats()
      if (!stats || !stats.top) {
        await sendTelegramMessage(chatId, 'Топ-вакансии не найдены.')
        return NextResponse.json({ ok: true })
      }
      await sendTelegramMessage(chatId, [
        '<b>Топ-3 вакансии</b>',
        '',
        stats.top,
        '',
        'Полный список: /status',
      ].join('\n'))
      return NextResponse.json({ ok: true })
    }

    // Command: /help
    if (text === '/help') {
      await sendTelegramMessage(chatId, [
        '<b>Доступные команды:</b>',
        '',
        '/status — статистика пайплайна',
        '/top — топ-3 вакансии по AI-скору',
        '/help — этот список',
        '',
        'Свободный текст — AI карьерный советник',
      ].join('\n'))
      return NextResponse.json({ ok: true })
    }

    // Free text → AI career advice (simple, no streaming)
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await fetch(
          `${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
              max_tokens: 500,
              system: 'Ты AI карьерный советник. Отвечай кратко (до 200 слов), на русском. Давай конкретные советы по поиску работы, подготовке к собеседованиям, улучшению CV.',
              messages: [{ role: 'user', content: text }],
            }),
          }
        )
        const data = await response.json()
        const reply = data.content?.[0]?.text || 'Не удалось получить ответ от AI.'
        await sendTelegramMessage(chatId, reply, 'Markdown')
      } catch {
        await sendTelegramMessage(chatId, 'AI-советник временно недоступен. Попробуйте /status.')
      }
    } else {
      await sendTelegramMessage(chatId, 'AI-советник не настроен. Используйте /status или /top.')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

// GET: Setup webhook (call once)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const host = url.searchParams.get('host') || url.origin

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 400 })
  }

  const webhookUrl = `${host}/api/telegram`
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })
  const data = await res.json()

  return NextResponse.json({
    message: 'Webhook configured',
    webhookUrl,
    telegram_response: data,
  })
}
