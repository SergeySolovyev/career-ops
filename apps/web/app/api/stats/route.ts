import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

function loadJSON(filename: string) {
  const filePath = join(process.cwd(), 'data', filename)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

const EMPTY_FUNNEL = {
  funnel: {
    found: 0,
    preScreened: 0,
    aiEvaluated: 0,
    recommended: 0,
    applied: 0,
    interviews: 0,
    offers: 0,
  },
  stats: { totalEvaluated: 0, avgScore: '0', topScore: 0, applyRate: '0' },
  topVacancies: [],
  lastRun: null,
  _source: 'user' as const,
}

export async function GET() {
  // Authenticated users get their own (empty) funnel, not Sergey's demo data.
  // Anonymous callers fall through to the demo branch below but with
  // topVacancies stripped (defense-in-depth: even if a future regression puts
  // real URLs back into auto-eval-log.json, anon will not see them).
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Real per-user funnel from user_evaluations + application_log.
        // Discovered 2026-05-28 — old TODO returned EMPTY_FUNNEL even when
        // the user had scanned vacancies, so /analytics was dead for everyone.
        const { data: evals } = await supabase
          .from('user_evaluations')
          .select('url, title, company, ai_score, ai_verdict, evaluated_at')
          .eq('user_id', user.id)
          .order('evaluated_at', { ascending: false })

        const { data: applies } = await supabase
          .from('application_log')
          .select('status')
          .eq('user_id', user.id)

        const rows = evals ?? []
        const appRows = applies ?? []

        const found = rows.length
        // For now hh scans don't expose a pre-screen vs AI-evaluate distinction;
        // every row in user_evaluations went through the full AI pipeline.
        const preScreened = found
        const aiEvaluated = found
        const recommended = rows.filter(
          (r: any) => r.ai_verdict === 'apply' || r.ai_verdict === 'maybe',
        ).length
        const applied = appRows.filter((a: any) =>
          ['sent', 'delivered', 'replied'].includes(a.status),
        ).length
        const interviews = appRows.filter((a: any) => a.status === 'interview').length
        const offers = appRows.filter((a: any) => a.status === 'offer').length

        const scores = rows
          .map((r: any) => Number(r.ai_score) || 0)
          .filter((s: number) => s > 0)
        const avgScore =
          scores.length > 0
            ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)
            : '0'
        const topScore = scores.length > 0 ? Math.max(...scores) : 0
        const applyRate =
          found > 0 ? ((applied / found) * 100).toFixed(0) : '0'

        // Top 5 by score — privacy-safe: only owner sees their own URLs.
        const topVacancies = rows
          .slice()
          .sort((a: any, b: any) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
          .slice(0, 5)
          .map((r: any) => ({
            url: r.url,
            score: r.ai_score,
            report: `${r.title}${r.company ? ` · ${r.company}` : ''}`,
            date: r.evaluated_at,
          }))

        const lastRun = rows[0]?.evaluated_at ?? null

        return NextResponse.json({
          funnel: { found, preScreened, aiEvaluated, recommended, applied, interviews, offers },
          stats: { totalEvaluated: aiEvaluated, avgScore, topScore, applyRate },
          topVacancies,
          lastRun,
          _source: 'user' as const,
        })
      }
    } catch {
      // fall through to demo
    }
  }

  try {
    const evalLog = loadJSON('auto-eval-log.json')
    let records: any[] = []
    try {
      const outreach = loadJSON('outreach.json')
      records = outreach.records || []
    } catch {
      // outreach.json is optional (removed from repo for privacy);
      // fall back to empty records — applied/interviews/offers will be 0.
      records = []
    }

    const entries = Object.entries(evalLog.evaluated || {}) as [string, any][]

    // Funnel stages — maintains invariant: found ≥ preScreened ≥ aiEvaluated ≥ recommended.
    // aiEvaluated means "ran through AI evaluator" (anything that passed pre-screen),
    // not "has a .md report file" — those are only generated for apply verdicts.
    const found = entries.length
    const preScreened = entries.filter(([, v]) => v.status !== 'pre-screen-fail').length
    const aiEvaluated = preScreened  // everything that passes pre-screen goes to AI
    const recommended = entries.filter(([, v]) => ['apply', 'maybe'].includes(v.status)).length
    const applied = records.filter((r: any) => ['sent', 'delivered', 'replied'].includes(r.status)).length
    const interviews = records.filter((r: any) => r.status === 'interview').length
    const offers = records.filter((r: any) => r.status === 'offer').length

    // Score distribution
    const scores = entries
      .filter(([, v]) => v.score > 0)
      .map(([, v]) => v.score as number)

    const avgScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : '0'

    // Top companies are intentionally NOT exposed to anonymous demo callers.
    // Authenticated users already returned EMPTY_FUNNEL above; the only path
    // that reaches here is anon. Defense-in-depth: even if a future
    // regression puts real URLs back into auto-eval-log.json, anon will not
    // see them. Returned as [] to preserve the response shape.
    const topVacancies: Array<{ url: string; score: number; report: string; date: string }> = []

    return NextResponse.json({
      funnel: {
        found,
        preScreened,
        aiEvaluated,
        recommended,
        applied,
        interviews,
        offers,
      },
      stats: {
        totalEvaluated: found,
        avgScore,
        topScore: scores.length > 0 ? Math.max(...scores) : 0,
        applyRate: found > 0 ? ((recommended / found) * 100).toFixed(1) : '0',
      },
      topVacancies,
      lastRun: evalLog.last_run,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
