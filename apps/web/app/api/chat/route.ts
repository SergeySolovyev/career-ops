import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

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

/**
 * Segment-specific tone instructions for the AI advisor system prompt.
 * Mirrors packages/core/src/evaluator/ai-evaluate.ts buildIcpGuidance() so
 * advisor and evaluator surfaces stay consistent.
 *
 * - junior: portfolio/mentorship focus, NO $200K/equity talk
 * - senior: ownership, technical leadership, equity-negotiation
 * - middle (default): balanced growth-path advice, market rates
 */
function buildChatIcpGuidance(seg: string | null | undefined): string {
  if (seg === 'junior') {
    return `Кандидат — JUNIOR. Давай советы под junior-level: portfolio, pet-проекты, mentorship, базовый stack, onboarding-программы. НЕ советуй "ты должен договориться о $200K" или "запроси equity" — это не для junior уровня. Норма зарплата: 80-150K ₽.`
  }
  if (seg === 'senior') {
    return `Кандидат — SENIOR. Советы под senior-level: ownership, technical leadership, equity-negotiation, стратегические решения, architecture decisions. Норма зарплата: 300K-1M ₽.`
  }
  return `Кандидат — MIDDLE. Балансные советы: growth path, ownership feature/team, рыночные ставки, переход на senior-track. Норма зарплата: 150-300K ₽.`
}

// Read logged-in user's CV from Supabase. Returns { cv, summary, isDemo, icpSegment }.
async function loadContextForUser(): Promise<{
  cv: string
  summary: string
  isDemo: boolean
  icpSegment: string | null
}> {
  if (!isSupabaseConfigured()) {
    return {
      cv: loadDemoCV(),
      summary: loadDemoProfileSummary(),
      isDemo: true,
      icpSegment: null,
    }
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return {
        cv: loadDemoCV(),
        summary: loadDemoProfileSummary(),
        isDemo: true,
        icpSegment: null,
      }
    }

    const { data } = await supabase
      .from('user_profiles')
      .select(
        'full_name, cv_text, target_roles, salary_min, salary_max, positive_keywords, icp_segment, skills, experience_years, city, remote_ok',
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data?.cv_text) {
      // Logged in but no CV saved — still answer but note empty profile
      return {
        cv: `Пользователь ${data?.full_name || user.email} пока не загрузил CV.`,
        summary: `Залогинен как ${data?.full_name || user.email}, CV ещё не загружено. Попроси пользователя заполнить профиль в /settings.`,
        isDemo: false,
        icpSegment: data?.icp_segment ?? null,
      }
    }

    const icpBlock = data.icp_segment
      ? `Уровень: ${String(data.icp_segment).toUpperCase()} (${data.experience_years ?? 0} лет опыта)`
      : null
    const cityBlock = data.city
      ? `Город: ${data.city}${data.remote_ok ? ' · открыт к удалёнке' : ' · только onsite'}`
      : null
    const skillsBlock = data.skills?.length
      ? `Skills: ${data.skills.slice(0, 10).join(', ')}`
      : null

    const summary = [
      `Кандидат: ${data.full_name || user.email}`,
      icpBlock,
      data.target_roles?.length ? `Целевые роли: ${data.target_roles.join('; ')}` : null,
      cityBlock,
      skillsBlock,
      data.salary_min || data.salary_max
        ? `Зарплата: ${data.salary_min ?? '?'}-${data.salary_max ?? '?'} RUB`
        : null,
      data.positive_keywords?.length
        ? `Ключевые интересы: ${data.positive_keywords.slice(0, 5).join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      cv: data.cv_text.slice(0, 8000),
      summary,
      isDemo: false,
      icpSegment: data.icp_segment ?? null,
    }
  } catch (e) {
    console.error('[api/chat] loadContextForUser error', e)
    return {
      cv: loadDemoCV(),
      summary: loadDemoProfileSummary(),
      isDemo: true,
      icpSegment: null,
    }
  }
}

export async function POST(req: Request) {
  // Rate limit guard — 10/min/user (or per-IP for anon). Log mode by default
  // until Day +2 post-launch (RATE_LIMIT_MODE=enforce).
  let userId: string | undefined
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    } catch {
      /* continue with IP-based limit */
    }
  }
  const limited = await checkRateLimit(req, RATE_LIMITS.chat, userId)
  if (limited) return limited

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

  const { cv, summary, isDemo, icpSegment } = await loadContextForUser()

  // ICP-aware tone instructions. Demo mode (Sergey) is treated as senior;
  // otherwise we honor the candidate's icp_segment from user_profiles. This
  // prevents Maria-the-junior from receiving "ask for $200K + equity"
  // playbooks tuned for Director-level execs.
  const icpGuidance = isDemo
    ? buildChatIcpGuidance('senior')
    : buildChatIcpGuidance(icpSegment)

  const system = isDemo
    ? `Ты — AI карьерный консультант платформы CareerPilot.
Это демонстрационный режим: отвечай по данным Сергея Соловьёва (из CV ниже). Если пользователь явно просит ответить по своему CV — попроси его залогиниться и заполнить /settings.

КРАТКИЙ ПРОФИЛЬ:
${summary}

ICP-КОНТЕКСТ (тон ответов):
${icpGuidance}

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

ICP-КОНТЕКСТ (тон ответов):
${icpGuidance}

ПОЛНОЕ CV КАНДИДАТА (markdown):
${cv}

ПРАВИЛА:
- Отвечай на русском языке
- Обращайся к кандидату на "вы"
- Опирайся ТОЛЬКО на факты из CV этого пользователя выше (НЕ на демо-данные Сергея Соловьёва)
- Если CV пустое — попроси пользователя заполнить профиль в /settings
- Учитывай ICP-уровень кандидата (см. блок выше): советы под junior отличаются от советов под senior
- Будь конкретен, actionable
- Максимум 300 слов, используй Markdown`

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'),
    system,
    messages: normalized,
  })

  return result.toUIMessageStreamResponse()
}
