import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

const anthropic = process.env.ANTHROPIC_BASE_URL
  ? createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    })
  : createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, cv_text, target_roles, salary_min, salary_max')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.cv_text) {
      return NextResponse.json({ error: 'CV is empty — complete step 1 first' }, { status: 400 })
    }

    const cv = profile.cv_text.slice(0, 8000)
    const roles = profile.target_roles?.length
      ? profile.target_roles.join(', ')
      : 'не указаны'
    const salary =
      profile.salary_min || profile.salary_max
        ? `${profile.salary_min ?? '?'}–${profile.salary_max ?? '?'} RUB`
        : 'не указана'
    const name = profile.full_name || user.email?.split('@')[0] || 'Кандидат'

    const { text } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'),
      system: `Ты — AI карьерный консультант платформы CareerPilot. Твоя задача — прочитать CV кандидата и дать персональный первый совет + одну конкретную задачу на эту неделю. Опирайся ТОЛЬКО на факты из CV ниже. Пиши на "вы", по-русски, в markdown, не больше 200 слов.`,
      prompt: `Кандидат: ${name}
Целевые роли: ${roles}
Зарплатные ожидания: ${salary}

CV кандидата:
${cv}

Сформулируй:
1) Короткое приветствие с упоминанием 1–2 самых сильных фактов из CV
2) Одну рекомендацию на базе реального опыта кандидата
3) Одну конкретную задачу на эту неделю (checkbox)`,
    })

    return NextResponse.json({ message: text })
  } catch (e: any) {
    console.error('[api/onboarding/first-response] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
