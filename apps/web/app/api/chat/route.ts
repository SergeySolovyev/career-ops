import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { readFileSync } from 'fs'
import { join } from 'path'

// Support ProxyAPI or direct Anthropic
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
})

// Static CV context
const CV_CONTEXT = `Соловьев Сергей Сергеевич
Советник Президента — Председателя Правления АО Мособлбанк (Группа ПСБ)
20 лет на финансовых рынках. Портфель $4B+, money market 100 млрд руб/день.
AI/ML: 3 препринта 2026, двойная магистратура ВШЭ + WorldQuant 2027.
DeFi: инфраструктура, регулирование ЦФА ФЗ-259/ФЗ-34/ФЗ-221.
Ключевые навыки: Treasury, Risk Management, AI/ML, Blockchain, Python, LangChain.
Целевые роли: CDO, Head of AI, Director Digital Transformation, CTO FinTech.`

// Load top vacancies from seed data
function getTopVacancies(): string {
  try {
    const filePath = join(process.cwd(), 'data', 'auto-eval-log.json')
    const evalLog = JSON.parse(readFileSync(filePath, 'utf-8'))
    const entries = Object.entries(evalLog.evaluated || {}) as [string, any][]
    const top = entries
      .filter(([, v]) => v.status === 'apply' && v.score >= 4.0)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([url, v]) => `- ${v.report || url} (score: ${v.score})`)
      .join('\n')
    return top || 'Нет оценённых вакансий'
  } catch {
    return 'Данные вакансий недоступны'
  }
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
    system: `Ты — AI карьерный консультант платформы CareerPilot.
Ты помогаешь кандидату с поиском работы, подготовкой к собеседованиям, улучшением CV и стратегией поиска.

ПРОФИЛЬ КАНДИДАТА:
${CV_CONTEXT}

ТОП ВАКАНСИИ (AI-оценка ≥ 4.0):
${getTopVacancies()}

ПРАВИЛА:
- Отвечай на русском языке
- Используй данные из профиля для конкретных советов
- Если спрашивают про конкретную вакансию — ссылайся на оценку
- Будь конкретен, давай actionable советы
- Максимум 300 слов на ответ`,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
