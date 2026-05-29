import { NextResponse } from 'next/server'
import { aiEvaluate } from '@careerpilot/core'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { connectBrowser, DEFAULT_CONTEXT_OPTIONS, isBrowserlessConfigured } from '@/lib/browserless'
import { decryptJson } from '@/lib/encryption'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { resolveTierState, checkQuota } from '@/lib/tier'
import { getCached, setCached } from '@/lib/anthropic-cache'

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

export async function POST(req: Request) {
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

    // Rate limit guard — 3/min/user. Scans are expensive (~$0.05/call),
    // strict limit. Log mode by default until Day +2 post-launch.
    const limited = await checkRateLimit(req, RATE_LIMITS.scanNow, user.id)
    if (limited) return limited

    // Tier quota gate — Free = 3 AI-evaluations / 30 days, Pro/Premium unlimited.
    // 402 Payment Required is the conventional code for "upgrade to continue".
    const tierState = await resolveTierState(supabase, user.id)
    const quota = checkQuota(tierState)
    if (quota.blocked) {
      return NextResponse.json(
        {
          error: quota.message,
          reason: quota.reason,
          used: quota.used,
          limit: quota.limit,
          upgradeUrl: '/?intent=pro&promo=BETA99',
        },
        { status: 402 },
      )
    }

    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select(
        'cv_text, target_roles, positive_keywords, negative_keywords, icp_segment, skills, experience_years',
      )
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profileRow?.cv_text) {
      return NextResponse.json({ error: 'CV is empty — fill onboarding first' }, { status: 400 })
    }

    const profile = {
      cv_text: profileRow.cv_text as string,
      target_roles: profileRow.target_roles as string[] | null,
      positive_keywords: profileRow.positive_keywords as string[] | null,
      negative_keywords: profileRow.negative_keywords as string[] | null,
      // NEW (Day 2 ICP-aware fields, defensive defaults if migration 004 not applied yet):
      icp_segment: ((profileRow as any).icp_segment ?? 'middle') as
        | 'junior'
        | 'middle'
        | 'senior',
      skills: (((profileRow as any).skills as string[] | null) ?? []) as string[],
      experience_years: ((profileRow as any).experience_years as number | null) ?? 0,
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

    // 3) Take top N for AI eval. Cap by per-scan limit AND by remaining quota.
    //    Without the quota cap, a Free user with quota.remaining=3 would still
    //    get 5 evaluations because MAX_EVALS=5 is hardcoded — they'd consume
    //    more than they paid for. Caught in PM E2E walkthrough 2026-05-30.
    const remainingQuota = tierState.remaining ?? Infinity
    const evalsBudget = Math.min(MAX_EVALS, remainingQuota)
    const toEval = fresh.slice(0, evalsBudget)

    const profileSummary = `Целевые роли: ${queries.join('; ')}`
    const inserted: Array<{ url: string; ai_score: number; ai_verdict: string }> = []

    // Day 5: Anthropic graceful degradation.
    // Track consecutive Anthropic failures — if ≥2 in a row, treat as outage,
    // abort scan + return 503 (or cached fallback if available).
    const cacheKey = `scan-now:${user.id}`
    let consecutiveAnthropicFails = 0
    let anthropicOutage = false

    for (const vacancy of toEval) {
      if (anthropicOutage) break
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
            // ICP-aware fields (Day 2.4):
            icpSegment: profile.icp_segment,
            skills: profile.skills,
            experienceYears: profile.experience_years,
          },
        )

        // Reset consecutive-fail counter on success
        consecutiveAnthropicFails = 0

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
      } catch (e: any) {
        console.error('[scan-now] eval error for', vacancy.url, e)
        // Treat any aiEvaluate exception as an Anthropic failure for backoff
        consecutiveAnthropicFails++
        if (consecutiveAnthropicFails >= 2) {
          anthropicOutage = true
          console.warn(
            '[scan-now] Anthropic outage detected (>=2 consecutive fails), aborting scan',
          )
        }
      }
    }

    // If outage detected AND nothing got through, attempt cached fallback or 503.
    if (anthropicOutage && inserted.length === 0) {
      const cached = getCached<typeof inserted>(cacheKey)
      if (cached && cached.length > 0) {
        return NextResponse.json({
          ok: true,
          degraded: true,
          message:
            'AI временно недоступен — показываем результаты последнего сканирования.',
          scanned: scanned.length,
          fresh: fresh.length,
          evaluated: cached.length,
          results: cached,
          usedSession: !!hhSession,
        })
      }
      return NextResponse.json(
        {
          error:
            'AI-сервис временно недоступен. Попробуйте через минуту.',
          retryAfter: 60,
        },
        { status: 503, headers: { 'Retry-After': '60' } },
      )
    }

    // On success, cache the inserted results for next-time fallback
    if (inserted.length > 0) {
      setCached(cacheKey, inserted)
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
