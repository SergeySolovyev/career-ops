import { NextResponse } from 'next/server'
import { aiEvaluate } from '@careerpilot/core'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { connectBrowser, DEFAULT_CONTEXT_OPTIONS, isBrowserlessConfigured } from '@/lib/browserless'
import { decryptJson } from '@/lib/encryption'

// Vercel default = 60s. Allow up to 60s for: Browserless connect (~2s) +
// search 1–3 queries (~5s each) + AI evaluate top 6 (~5s each).
export const maxDuration = 60

const MAX_QUERIES = 2          // limit user's roles to top 2 (each = ~30 listings)
const MAX_EVALS = 5            // AI-evaluate up to 5 vacancies per scan

interface ScannedVacancy {
  url: string
  title: string
  company: string
  salary: string | null
  location: string | null
  description: string
}

/**
 * Scrape HH search via Playwright (running on our DO Browserless instance).
 * If hhSession is provided we restore the user's cookies first — gives
 * personalized results. Without it, we get public anonymous results
 * (still useful for cold-start users).
 */
async function scanHHViaBrowserless(
  queries: string[],
  hhSession: { cookies: any[] } | null,
): Promise<ScannedVacancy[]> {
  const browser = await connectBrowser()
  const ctx = await browser.newContext({
    ...DEFAULT_CONTEXT_OPTIONS,
    storageState: hhSession ? { cookies: hhSession.cookies, origins: [] } : undefined,
  })

  try {
    const page = await ctx.newPage()
    const seen = new Set<string>()
    const results: ScannedVacancy[] = []

    for (const query of queries) {
      const url = `https://hh.ru/search/vacancy?text=${encodeURIComponent(query)}&area=1&order_by=publication_time`
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      if (!r || r.status() !== 200) continue

      // Wait for vacancy cards
      await page.waitForSelector('[data-qa="vacancy-serp__vacancy"]', { timeout: 15_000 }).catch(() => {})

      const items = await page.$$eval('[data-qa="vacancy-serp__vacancy"]', (els) => {
        return els.slice(0, 30).map((el) => {
          const titleEl = el.querySelector('[data-qa="serp-item__title"]') as HTMLAnchorElement | null
          const companyEl = el.querySelector('[data-qa="vacancy-serp__vacancy-employer-text"], [data-qa="vacancy-serp__vacancy-employer"]') as HTMLElement | null
          const salaryEl = el.querySelector('[data-qa="vacancy-serp__vacancy-compensation"]') as HTMLElement | null
          const locationEl = el.querySelector('[data-qa="vacancy-serp__vacancy-address"]') as HTMLElement | null
          const descEl = el.querySelector('[data-qa^="vacancy-serp__vacancy_snippet"], .g-user-content') as HTMLElement | null
          return {
            url: titleEl?.href || '',
            title: titleEl?.textContent?.trim() || '',
            company: companyEl?.textContent?.trim() || '',
            salary: salaryEl?.textContent?.trim() || null,
            location: locationEl?.textContent?.trim() || null,
            description: (descEl?.textContent || '').trim().slice(0, 800),
          }
        })
      })

      for (const it of items) {
        if (!it.url) continue
        // Strip query string for canonical url
        const canonical = it.url.split('?')[0]
        if (seen.has(canonical)) continue
        seen.add(canonical)
        results.push({ ...it, url: canonical })
      }
    }

    return results
  } finally {
    await ctx.close()
  }
}

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  if (!isBrowserlessConfigured()) {
    return NextResponse.json(
      { error: 'BROWSERLESS_WSS / BROWSERLESS_TOKEN not set' },
      { status: 503 },
    )
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

    const queries = (profile.target_roles?.length ? profile.target_roles : []).slice(0, MAX_QUERIES)
    if (queries.length === 0) {
      return NextResponse.json({ error: 'No target roles set — add them in /settings' }, { status: 400 })
    }

    // Try to load HH session if user has captured one
    let hhSession: { cookies: any[] } | null = null
    const { data: sess } = await supabase
      .from('hh_sessions')
      .select('iv, ciphertext, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (sess?.iv && sess?.ciphertext) {
      try {
        hhSession = decryptJson<{ cookies: any[] }>({ iv: sess.iv, ciphertext: sess.ciphertext })
      } catch (e) {
        console.warn('[scan-now] failed to decrypt HH session, falling back to anonymous', e)
      }
    }

    // 1) Scrape via Browserless
    const scanned = await scanHHViaBrowserless(queries, hhSession)

    // 2) Skip already-evaluated for this user
    const { data: existing } = await supabase
      .from('user_evaluations')
      .select('url')
      .eq('user_id', user.id)
    const seenUrls = new Set((existing || []).map((r) => r.url))
    const fresh = scanned.filter((v) => !seenUrls.has(v.url))

    // 3) Take top N for AI eval (no pre-screen — Browserless results are already filtered by HH)
    const toEval = fresh.slice(0, MAX_EVALS)

    const profileSummary = `Целевые роли: ${queries.join('; ')}`
    const inserted: Array<{ url: string; ai_score: number; ai_verdict: string }> = []

    for (const vacancy of toEval) {
      try {
        const evalResult = await aiEvaluate(
          vacancy.title,
          vacancy.company,
          vacancy.description,
          {
            apiKey,
            cvText: profile.cv_text,
            profileSummary,
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
          },
        )

        const row = {
          user_id: user.id,
          url: vacancy.url,
          source: 'hh_ru',
          title: vacancy.title,
          company: vacancy.company,
          location: vacancy.location,
          description: vacancy.description,
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
      usedSession: !!hhSession,
    })
  } catch (e: any) {
    console.error('[scan-now] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
