import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TG_API = `https://api.telegram.org/bot${TG_TOKEN}`

async function sendMessage(chatId: number, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  })
  return res.json()
}

function loadJSON(filename: string) {
  const filePath = join(process.cwd(), 'data', filename)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function handleStatus(): string {
  try {
    const evalLog = loadJSON('auto-eval-log.json')
    const outreach = loadJSON('outreach.json')

    const entries = Object.entries(evalLog.evaluated || {}) as [string, any][]
    const records = outreach.records || []

    const found = entries.length
    const aiEvaluated = entries.filter(([, v]) => v.report).length
    const recommended = entries.filter(([, v]) => ['apply', 'maybe'].includes(v.status)).length
    const applied = records.filter((r: any) => ['sent', 'delivered', 'replied'].includes(r.status)).length
    const interviews = records.filter((r: any) => r.status === 'interview').length

    const scores = entries.filter(([, v]) => v.score > 0).map(([, v]) => v.score as number)
    const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '0'

    return `📊 *CareerPilot — Статус*

🔍 Найдено: *${found}*
🤖 Оценено AI: *${aiEvaluated}*
⭐ Рекомендовано: *${recommended}*
📧 Отклики: *${applied}*
💼 Интервью: *${interviews}*

📈 Средний скор: *${avgScore}/5*

_Используй /top для топ-5 вакансий или просто задай вопрос._`
  } catch {
    return 'Не удалось загрузить статистику.'
  }
}

function handleTop(): string {
  try {
    const evalLog = loadJSON('auto-eval-log.json')
    const entries = Object.entries(evalLog.evaluated || {}) as [string, any][]
    const top = entries
      .filter(([, v]) => v.status === 'apply')
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)

    if (top.length === 0) return 'Топовых вакансий пока нет.'

    const list = top.map(([url, v], i) => {
      const name = v.report?.replace('.md', '').replace(/^\d+-/, '').replace(/-/g, ' ') || 'Вакансия'
      return `${i + 1}. *${v.score}/5* — ${name}\n[hh.ru](${url})`
    }).join('\n\n')

    return `⭐ *Топ-5 вакансий*\n\n${list}`
  } catch {
    return 'Не удалось загрузить топ вакансий.'
  }
}

async function handleFreeText(text: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return 'AI-советник временно недоступен (нет API-ключа).'

  try {
    const baseURL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

    const res = await fetch(`${baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: `Ты — AI карьерный консультант CareerPilot. Отвечай кратко (до 200 слов), на русском, в Markdown для Telegram.
Профиль кандидата: Соловьев С.С., TradFi→DeFi+AI, 20 лет финрынков, портфель $4B+.
Целевые роли: CDO, Head of AI, Director Digital Transformation.`,
        messages: [{ role: 'user', content: text }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || 'Не удалось получить ответ.'
  } catch (e: any) {
    return `Ошибка: ${e.message}`
  }
}

export async function POST(req: Request) {
  try {
    const update = await req.json()
    const message = update.message
    if (!message?.text) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const text = message.text.trim()

    let reply = ''

    if (text === '/start') {
      reply = `👋 Привет! Я *CareerPilot Bot* — твой AI-ассистент в поиске работы.

📋 Команды:
/status — статистика поиска
/top — топ-5 вакансий
/help — справка

💬 Или просто задай вопрос о карьере!`
    } else if (text === '/status') {
      reply = handleStatus()
    } else if (text === '/top') {
      reply = handleTop()
    } else if (text === '/help') {
      reply = `🤖 *CareerPilot Bot*

Команды:
/status — воронка поиска
/top — лучшие вакансии
/help — эта справка

*Примеры вопросов:*
• Как подготовиться к интервью?
• Что написать в cover letter?
• Как вести переговоры по зарплате?

🌐 Web: careerpilot.vercel.app`
    } else {
      reply = await handleFreeText(text)
    }

    await sendMessage(chatId, reply)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET для проверки работоспособности
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    bot: 'CareerPilot',
    commands: ['/start', '/status', '/top', '/help'],
  })
}
