import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { readFileSync } from 'fs'
import { join } from 'path'

// Support ProxyAPI or direct Anthropic (SDK default baseURL includes /v1)
const anthropic = process.env.ANTHROPIC_BASE_URL
  ? createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    })
  : createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

function loadCV(): string {
  try {
    const cvPath = join(process.cwd(), 'data', 'cv-ru.md')
    return readFileSync(cvPath, 'utf-8').slice(0, 8000)
  } catch {
    return 'CV не загружен'
  }
}

function loadProfileSummary(): string {
  try {
    const p = JSON.parse(readFileSync(join(process.cwd(), 'data', 'profile.json'), 'utf-8'))
    const c = p.candidate
    const t = p.target
    return `Кандидат: ${c.full_name}, ${c.current_role}
Целевые роли: ${t.roles.join('; ')}
Зарплата: ${t.salary_target_min}-${t.salary_target_max} ${t.currency} (min ${t.salary_min})
Superpowers: ${(p.superpowers || []).slice(0, 3).join(' | ')}`
  } catch {
    return ''
  }
}

const CV_CONTEXT = loadCV()
const PROFILE_SUMMARY = loadProfileSummary()

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

  // Normalize both AI SDK v6 UIMessage (parts[]) and CoreMessage (content:string) formats
  const normalized = (messages as any[])
    .map((m) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.parts)
          ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
          : '',
    }))
    .filter((m) => m.content && m.content.length > 0)
    .map((m) => ({ ...m, content: m.content.slice(0, 8000) }))

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'),
    system: `Ты — AI карьерный консультант платформы CareerPilot.
Помогаешь кандидату с поиском работы, подготовкой к интервью, tailoring CV и стратегией.

КРАТКИЙ ПРОФИЛЬ:
${PROFILE_SUMMARY}

ПОЛНОЕ CV КАНДИДАТА (markdown):
${CV_CONTEXT}

ТОП ВАКАНСИИ (AI-оценка ≥ 4.0):
${getTopVacancies()}

ПРАВИЛА:
- Отвечай на русском языке
- Обращайся к кандидату на "вы"
- Опирайся на конкретные факты из CV (компании, проекты, метрики)
- Если спрашивают про вакансию из списка — ссылайся на скор и причины
- Будь конкретен, actionable, давай цифры и примеры из его опыта
- Максимум 300 слов на ответ, используй Markdown`,
    messages: normalized,
  })

  return result.toUIMessageStreamResponse()
}
