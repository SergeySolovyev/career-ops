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
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // TODO: query per-user evaluation/outreach tables once they exist.
        return NextResponse.json(EMPTY_FUNNEL)
      }
    } catch {
      // fall through to demo
    }
  }

  try {
    const evalLog = loadJSON('auto-eval-log.json')
    const outreach = loadJSON('outreach.json')

    const entries = Object.entries(evalLog.evaluated || {}) as [string, any][]
    const records = outreach.records || []

    // Funnel stages
    const found = entries.length
    const preScreened = entries.filter(([, v]) => v.status !== 'pre-screen-fail').length
    const aiEvaluated = entries.filter(([, v]) => v.report).length
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

    // Top companies
    const topVacancies = entries
      .filter(([, v]) => v.status === 'apply')
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([url, v]) => ({
        url,
        score: v.score,
        report: v.report,
        date: v.date,
      }))

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
