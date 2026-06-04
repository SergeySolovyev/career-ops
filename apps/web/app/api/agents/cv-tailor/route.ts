/**
 * POST /api/agents/cv-tailor
 *
 * Вызывает CV-Tailor Agent для конкретной (CV, vacancy) пары.
 *
 * Auth: требует аутентификации (cv-tailor сейчас Pro+ feature).
 * Tier gate: будет добавлен в Sprint A когда Pro tier станет dominant.
 * Rate limit: Pro = 10 tailorings/мес, Premium = unlimited.
 *
 * Request body:
 *   { vacancyId?: string }  — берём CV из user_profiles и вакансию из user_evaluations
 *   ИЛИ
 *   { originalCv: string, vacancy: {...} }  — для ad-hoc вызова из onboarding preview
 *
 * Response:
 *   200: { ok: true, output: CvTailorOutput, cost_usd: number, latency_ms: number }
 *   400: { error: 'CV is empty' } / { error: 'Invalid vacancy' }
 *   401: { error: 'Unauthorized' }
 *   500: { error: '...' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { tailorCv, type CvTailorInput } from '@/lib/agents/cv-tailor'

export const runtime = 'nodejs'
// CV-Tailor может занять до 30с на больших CV. Vercel default 60s.
export const maxDuration = 60

type Body =
  | { vacancyId: string }
  | { originalCv: string; vacancy: CvTailorInput['vacancy'] }

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit — re-use apply RATE_LIMIT (30/min). CV-tailor дороже scan но
    // редкая операция (тру user делает 1-3 в час, не 30/min).
    const limited = await checkRateLimit(req, RATE_LIMITS.apply, user.id)
    if (limited) return limited

    const body = (await req.json()) as Body

    let input: CvTailorInput

    if ('vacancyId' in body) {
      // Lookup CV + vacancy из БД
      const [{ data: profile }, { data: evaluation }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('cv_text')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_evaluations')
          .select('url, title, company, description, location, ai_score, ai_strengths, ai_weaknesses')
          .eq('user_id', user.id)
          .eq('url', body.vacancyId)
          .maybeSingle(),
      ])

      if (!profile?.cv_text) {
        return NextResponse.json(
          { error: 'CV is empty — заполните CV в /onboarding' },
          { status: 400 },
        )
      }
      if (!evaluation) {
        return NextResponse.json(
          { error: 'Vacancy not found in your evaluations' },
          { status: 400 },
        )
      }

      input = {
        originalCv: profile.cv_text,
        vacancy: {
          title: evaluation.title,
          company: evaluation.company,
          description: evaluation.description,
          location: evaluation.location,
        },
        matchAnalysis: {
          score: evaluation.ai_score,
          strengths: (evaluation.ai_strengths as string[]) ?? [],
          weaknesses: (evaluation.ai_weaknesses as string[]) ?? [],
        },
      }
    } else if ('originalCv' in body && 'vacancy' in body) {
      // Ad-hoc — для onboarding preview без сохранённой evaluation
      if (!body.originalCv || body.originalCv.length < 100) {
        return NextResponse.json(
          { error: 'CV too short (< 100 chars)' },
          { status: 400 },
        )
      }
      input = {
        originalCv: body.originalCv,
        vacancy: body.vacancy,
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid body — provide vacancyId or {originalCv, vacancy}' },
        { status: 400 },
      )
    }

    const result = await tailorCv(input, user.id)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.errorMessage ?? 'Agent failed' },
        { status: 502 },
      )
    }

    // Возвращаем + cost для UI feedback («сэкономили X секунд работы за $Y»)
    return NextResponse.json({
      ok: true,
      output: result.output,
      cost_usd: undefined, // см. agent_invocations table для cost-accounting
      latency_ms: result.latencyMs,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    })
  } catch (e: any) {
    console.error('[/api/agents/cv-tailor] error', e?.message ?? e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
