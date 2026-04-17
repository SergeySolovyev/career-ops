import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

// Support ProxyAPI or direct Anthropic (SDK default baseURL includes /v1)
const anthropic = process.env.ANTHROPIC_BASE_URL
  ? createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    })
  : createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

function loadDemoCV(): string {
  try {
    const cvPath = join(process.cwd(), 'data', 'cv-ru.md')
    return readFileSync(cvPath, 'utf-8').slice(0, 8000)
  } catch {
    return 'CV не загружен'
  }
}

function loadDemoProfileSummary(): string {
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

// Read logged-in user's CV from Supabase. Returns { cv, summary, isDemo }.
async function loadContextForUser(): Promise<{ cv: string; summary: string; isDemo: boolean }> {
  if (!isSupabaseConfigured()) {
    return { cv: loadDemoCV(), summary: loadDemoProfileSummary(), isDemo: true }
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { cv: loadDemoCV(), summary: loadDemoProfileSummary(), isDemo: true }
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, cv_text, target_roles, salary_min, salary_max, positive_keywords')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data?.cv_text) {
      // Logged in but no CV saved — still answer but note empty profile
      return {
        cv: `Пользователь ${data?.full_name || user.email} пока не загрузил CV.`,
        summary: `Залогинен как ${data?.full_name || user.email}, CV ещё не загружено. Попроси пользователя заполнить профиль в /settings.`,
        isDemo: false,
      }
    }

    const summary = [
      `Кандидат: ${data.full_name || user.email}`,
      data.target_roles?.length ? `Целевые роли: ${data.target_roles.join('; ')}` : null,
      data.salary_min || data.salary_max
        ? `Зарплата: ${data.salary_min ?? '?'}-${data.salary_max ?? '?'} RUB`
        : null,
      data.positive_keywords?.length
        ? `Ключевые интересы: ${data.positive_keywords.slice(0, 5).join(', ')}`
        : null,
    ].filter(Boolean).join('\n')

    return {
      cv: data.cv_text.slice(0, 8000),
      summary,
      isDemo: false,
    }
  } catch (e) {
    console.error('[api/chat] loadContextForUser error', e)
    return { cv: loadDemoCV(), summary: loadDemoProfileSummary(), isDemo: true }
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

  const { cv, summary, isDemo } = await loadContextForUser()

  const system = isDemo
    ? `Ты — AI карьерный консультант платформы CareerPilot.
Это демонстрационный режим: отвечай по данным Сергея Соловьёва (из CV ниже). Если пользователь явно просит ответить по своему CV — попроси его залогиниться и заполнить /settings.

КРАТКИЙ ПРОФИЛЬ:
${summary}

ПОЛНОЕ CV КАНДИДАТА (markdown):
${cv}

ТОП ВАКАНСИИ (AI-оценка ≥ 4.0):
${getTopVacancies()}

ПРАВИЛА:
- Отвечай на русском языке
- Обращайся на "вы"
- Опирайся на конкретные факты из CV (компании, проекты, метрики)
- Будь конкретен, actionable
- Максимум 300 слов, используй Markdown`
    : `Ты — AI карьерный консультант платформы CareerPilot.
Помогаешь залогиненному кандидату с поиском работы, подготовкой к интервью, tailoring CV и стратегией.

КРАТКИЙ ПРОФИЛЬ:
${summary}

ПОЛНОЕ CV КАНДИДАТА (markdown):
${cv}

ПРАВИЛА:
- Отвечай на русском языке
- Обращайся к кандидату на "вы"
- Опирайся ТОЛЬКО на факты из CV этого пользователя выше (НЕ на демо-данные Сергея Соловьёва)
- Если CV пустое — попроси пользователя заполнить профиль в /settings
- Будь конкретен, actionable
- Максимум 300 слов, используй Markdown`

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'),
    system,
    messages: normalized,
  })

  return result.toUIMessageStreamResponse()
}
