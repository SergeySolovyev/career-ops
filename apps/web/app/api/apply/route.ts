/**
 * POST /api/apply { vacancy_url: string }
 *
 * End-to-end flow:
 *   1. Verify auth + apply_consent (legal record)
 *   2. Restore HH cookies via decryption
 *   3. Generate cover letter (Claude, via @careerpilot/core)
 *   4. Open vacancy in Browserless, click Откликнуться, fill cover, submit
 *   5. Log result to application_log
 */
import { NextResponse } from 'next/server'
import { generateCoverLetter } from '@careerpilot/core'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { connectBrowser, DEFAULT_CONTEXT_OPTIONS, isBrowserlessConfigured } from '@/lib/browserless'
import { decryptJson } from '@/lib/encryption'

export const maxDuration = 60

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  if (!isBrowserlessConfigured()) {
    return NextResponse.json({ error: 'Browserless not configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { vacancy_url } = await req.json()
    if (typeof vacancy_url !== 'string' || !vacancy_url.includes('hh.ru')) {
      return NextResponse.json({ error: 'Invalid vacancy_url' }, { status: 400 })
    }

    // 1) Disclaimer consent must exist
    const { data: consent } = await supabase
      .from('apply_consent')
      .select('agreed_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!consent) {
      return NextResponse.json(
        { error: 'consent_required', message: 'Disclaimer not accepted yet' },
        { status: 403 },
      )
    }

    // 2) HH session
    const { data: sess } = await supabase
      .from('hh_sessions')
      .select('iv, ciphertext, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!sess || sess.status !== 'active') {
      return NextResponse.json(
        { error: 'hh_session_missing', message: 'Connect HH account first' },
        { status: 400 },
      )
    }
    const { cookies } = decryptJson<{ cookies: any[] }>({ iv: sess.iv, ciphertext: sess.ciphertext })

    // 3) Profile + vacancy data for cover letter
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('cv_text, full_name')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile?.cv_text) {
      return NextResponse.json({ error: 'CV is empty' }, { status: 400 })
    }

    const { data: evalRow } = await supabase
      .from('user_evaluations')
      .select('title, company, description')
      .eq('user_id', user.id)
      .eq('url', vacancy_url)
      .maybeSingle()

    const vacancyTitle = evalRow?.title || 'вакансию'
    const vacancyCompany = evalRow?.company || 'компанию'

    // 4) Generate cover letter
    let coverLetter = 'Здравствуйте! Меня заинтересовала ваша вакансия. Готов обсудить детали.'
    try {
      const cover = await generateCoverLetter(
        {
          jdText: evalRow?.description || vacancyTitle,
          company: vacancyCompany,
          role: vacancyTitle,
          cvText: profile.cv_text,
          lang: 'ru',
        },
        process.env.ANTHROPIC_API_KEY
          ? {
              apiKey: process.env.ANTHROPIC_API_KEY,
              model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
            }
          : undefined,
      )
      coverLetter = (cover.text || coverLetter).slice(0, 1900)
    } catch (e) {
      console.warn('[apply] cover letter generation failed, using fallback', e)
    }

    // 5) Apply via Browserless
    const browser = await connectBrowser()
    const ctx = await browser.newContext({
      ...DEFAULT_CONTEXT_OPTIONS,
      storageState: { cookies, origins: [] },
    })

    let status = 'failed'
    let hhResponseId: string | null = null
    let errorMsg: string | null = null

    try {
      const page = await ctx.newPage()
      await page.goto(vacancy_url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // Already applied?
      const alreadyApplied = await page.locator('[data-qa="vacancy-response-link-top-again"]').first().isVisible().catch(() => false)
      if (alreadyApplied) {
        status = 'already_applied'
      } else {
        // Click Откликнуться
        const respondBtn = page.locator('[data-qa="vacancy-response-link-top"], [data-qa="vacancy-response-link-bottom"]').first()
        await respondBtn.waitFor({ timeout: 10_000 })
        await respondBtn.click()

        // Wait for response page or popup
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})

        // Toggle cover letter
        const letterToggle = page.locator('[data-qa="vacancy-response-letter-toggle"]').first()
        if (await letterToggle.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await letterToggle.click()
        }

        // Fill letter
        const letterInput = page.locator('[data-qa="vacancy-response-popup-form-letter-input"], [data-qa="vacancy-response-letter-informer"] textarea').first()
        if (await letterInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await letterInput.fill(coverLetter)
        }

        // Submit
        const submitBtn = page.locator('[data-qa="vacancy-response-submit-popup"]').first()
        await submitBtn.click()
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})

        // Verify
        const okIndicator = await page.locator('[data-qa="vacancy-response-link-top-again"], text=Отклик отправлен').first().isVisible({ timeout: 8_000 }).catch(() => false)
        if (okIndicator) {
          status = 'sent'
          // Try to extract negotiation id from URL
          const m = page.url().match(/negotiations?\/(\d+)/)
          hhResponseId = m?.[1] || null
        } else {
          status = 'failed'
          errorMsg = 'Submit clicked but no confirmation indicator found'
        }
      }
    } catch (e: any) {
      status = 'failed'
      errorMsg = e?.message || 'Browser automation error'
      console.error('[apply] browser error', e)
    } finally {
      await ctx.close()
    }

    // 6) Log to application_log
    await supabase.from('application_log').upsert(
      {
        user_id: user.id,
        vacancy_url,
        vacancy_title: evalRow?.title || null,
        vacancy_company: evalRow?.company || null,
        cover_letter: coverLetter,
        status,
        hh_response_id: hhResponseId,
        error_msg: errorMsg,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,vacancy_url' },
    )

    return NextResponse.json({ ok: status !== 'failed', status, error: errorMsg, hhResponseId })
  } catch (e: any) {
    console.error('[apply] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
