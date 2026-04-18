import { NextResponse } from 'next/server'
import { scanHHRu, preScreen, aiEvaluate } from '@careerpilot/core'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

// HH search + AI evaluation can take 30–50s for ~5 queries × 8 evals.
// Vercel default = 60s; bump explicitly so we don't get cut off.
export const maxDuration = 60

const MAX_QUERIES = 3 // limit user's roles to top 3
const MAX_EVALS = 6 // AI-evaluate up to 6 vacancies per scan (cost + time control)

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('cv_text, target_roles, positive_keywords, negative_keywords')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.cv_text) {
      return NextResponse.json({ error: 'CV is empty — fill onboarding first' }, { status: 400 })
    }

    // 1) Scan HH.ru with user's target_roles as queries
    const queries = (profile.target_roles?.length ? profile.target_roles : []).slice(0, MAX_QUERIES)
    if (queries.length === 0) {
      return NextResponse.json({ error: 'No target roles set — add them in /settings' }, { status: 400 })
    }

    const positiveKeywords: string[] = profile.positive_keywords || []
    const negativeKeywords: string[] = profile.negative_keywords || []

    const scanned = await scanHHRu({
      queries,
      positiveKeywords,
      negativeKeywords,
      area: 1, // Moscow
      experience: 'moreThan6',
      perPage: 50,
    })

    // 2) Skip vacancies already evaluated for this user
    const { data: existing } = await supabase
      .from('user_evaluations')
      .select('url')
      .eq('user_id', user.id)
    const seenUrls = new Set((existing || []).map((r) => r.url))
    const fresh = scanned.filter((v) => !seenUrls.has(v.url))

    // 3) Pre-screen, sort by pre-score, take top N for AI
    const preScored = fresh
      .map((v) => {
        const pre = preScreen(
          v.title,
          v.description || '',
          v.company,
          positiveKeywords,
          negativeKeywords
        )
        return { vacancy: v, pre }
      })
      // If user has no positive keywords yet, skip the pass-gate to ensure we still produce results
      .filter((x) => x.pre.passed || positiveKeywords.length === 0)
      .sort((a, b) => b.pre.score - a.pre.score)
      .slice(0, MAX_EVALS)

    // 4) AI evaluate each one and write to DB
    const profileSummary = `Целевые роли: ${queries.join('; ')}`
    const inserted: Array<{ url: string; ai_score: number; ai_verdict: string }> = []

    for (const { vacancy, pre } of preScored) {
      try {
        const evalResult = await aiEvaluate(
          vacancy.title,
          vacancy.company,
          vacancy.description || '',
          {
            apiKey,
            cvText: profile.cv_text,
            profileSummary,
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
          }
        )

        const row = {
          user_id: user.id,
          url: vacancy.url,
          external_id: vacancy.externalId,
          source: vacancy.source,
          title: vacancy.title,
          company: vacancy.company,
          salary_from: vacancy.salaryFrom ?? null,
          salary_to: vacancy.salaryTo ?? null,
          salary_currency: vacancy.salaryCurrency ?? null,
          location: vacancy.location ?? null,
          description: (vacancy.description || '').slice(0, 4000),
          pre_score: pre.score,
          ai_score: evalResult.score,
          ai_verdict: evalResult.verdict,
          ai_summary: evalResult.summary,
          ai_strengths: evalResult.strengths,
          ai_weaknesses: evalResult.weaknesses,
        }

        const { error: upErr } = await supabase
          .from('user_evaluations')
          .upsert(row, { onConflict: 'user_id,url' })

        if (!upErr) {
          inserted.push({
            url: vacancy.url,
            ai_score: evalResult.score,
            ai_verdict: evalResult.verdict,
          })
        } else {
          console.error('[scan-now] upsert error', upErr)
        }
      } catch (e) {
        console.error('[scan-now] eval error for', vacancy.url, e)
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: scanned.length,
      fresh: fresh.length,
      evaluated: inserted.length,
      results: inserted,
    })
  } catch (e: any) {
    console.error('[scan-now] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
