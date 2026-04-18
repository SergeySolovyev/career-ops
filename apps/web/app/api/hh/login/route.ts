/**
 * POST /api/hh/login { hh_login: string, hh_password: string }
 *
 * One-shot HH login via Browserless. Credentials never persisted —
 * we use them once to obtain session cookies, then encrypt+store cookies
 * and discard the password.
 *
 * Login flow ported from career-ops/scripts/hh-auto-apply.mjs lines 200-299:
 *   Screen 1: Select role (Applicant/Employer) → Continue
 *   Screen 2: Enter phone OR email → click "Войти с паролем" (NOT "Дальше" which sends SMS)
 *   Screen 3: Enter password → submit
 *
 * Returns:
 *   { ok: true, hh_email, cookieCount }                  — login OK, session saved
 *   { error: 'invalid_credentials' | 'sms_required' | 'captcha' | ... }
 */
import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { connectBrowser, DEFAULT_CONTEXT_OPTIONS, isBrowserlessConfigured } from '@/lib/browserless'
import { encryptJson } from '@/lib/encryption'

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

    const body = await req.json()
    const hhLogin = String(body?.hh_login || '').trim()
    const hhPassword = String(body?.hh_password || '')
    if (!hhLogin || !hhPassword) {
      return NextResponse.json({ error: 'hh_login and hh_password required' }, { status: 400 })
    }

    const browser = await connectBrowser()
    const ctx = await browser.newContext(DEFAULT_CONTEXT_OPTIONS)

    try {
      const page = await ctx.newPage()
      await page.goto('https://hh.ru/account/login', { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(1500)

      // Screen 1: Applicant role card (if shown)
      const roleCard = page.locator('[data-qa="account-type-card-APPLICANT"]')
      if (await roleCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await roleCard.check().catch(() => {})
        const submit1 = page.locator('[data-qa="submit-button"]')
        if (await submit1.isVisible().catch(() => false)) {
          await submit1.click()
          await page.waitForTimeout(1500)
        }
      }

      // Screen 2: Phone OR email input
      const isPhone = /^\+?7?\d{10,11}$/.test(hhLogin.replace(/\D/g, ''))
      let stage2Done = false

      if (isPhone) {
        const phoneInput = page.locator('[data-qa="magritte-phone-input-national-number-input"]')
        if (await phoneInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          const national = hhLogin.replace(/^\+?7/, '').replace(/\D/g, '')
          await phoneInput.click()
          await phoneInput.fill(national)
          // Critical: click "Войти с паролем" — NOT "Дальше" (which sends SMS)
          const pwBtn = page.locator('[data-qa="expand-login-by-password"]')
          if (await pwBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await pwBtn.click()
            await page.waitForTimeout(1500)
            stage2Done = true
          }
        }
      }

      if (!stage2Done) {
        // Try email/legacy flow
        const emailInput = page
          .locator('[data-qa="account-login-email"], [name="login"], input[type="email"]')
          .first()
        if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await emailInput.fill(hhLogin)
          const legacyBtn = page
            .locator('button:has-text("Войти с паролем"), button:has-text("Войти")')
            .first()
          if (await legacyBtn.isVisible().catch(() => false)) {
            await legacyBtn.click()
            await page.waitForTimeout(1500)
            stage2Done = true
          }
        }
      }

      // Screen 3: password
      const passwordInput = page
        .locator('[data-qa="applicant-login-input-password"], input[type="password"]')
        .first()
      if (!(await passwordInput.isVisible({ timeout: 8_000 }).catch(() => false))) {
        // Maybe HH demanded SMS code instead
        const smsField = page
          .locator('input[name="otp"], input[autocomplete="one-time-code"], [data-qa*="otp"]')
          .first()
        if (await smsField.isVisible({ timeout: 1_000 }).catch(() => false)) {
          return NextResponse.json(
            { error: 'sms_required', message: 'HH запросил SMS-код. Эта версия не поддерживает SMS. Используйте аккаунт с password-login без обязательной SMS-проверки, или попробуйте через 5 минут.' },
            { status: 400 },
          )
        }
        return NextResponse.json(
          { error: 'password_field_not_found', message: 'Не удалось дойти до поля пароля — возможно HH изменил вёрстку или запросил CAPTCHA.' },
          { status: 400 },
        )
      }
      await passwordInput.fill(hhPassword)

      const submitBtn = page
        .locator('[data-qa="submit-button"], button[type="submit"]')
        .first()
      await submitBtn.click()
      await page.waitForTimeout(4000)

      // Verify login
      const finalUrl = page.url()
      if (finalUrl.includes('/account/login') || finalUrl.includes('/auth/')) {
        // Check for inline error / captcha / SMS
        const errVisible = await page
          .locator('[data-qa*="error"], .bloko-form-error, [class*="error"]')
          .first()
          .isVisible({ timeout: 1_500 })
          .catch(() => false)
        return NextResponse.json(
          { error: errVisible ? 'invalid_credentials' : 'login_failed', message: 'HH отклонил логин. Проверьте login/password или попробуйте позже.' },
          { status: 400 },
        )
      }

      // Successful login — extract cookies for hh.ru
      const allCookies = await ctx.cookies()
      const hhCookies = allCookies.filter((c) => (c.domain || '').includes('hh.ru'))
      if (hhCookies.length < 3) {
        return NextResponse.json(
          { error: 'no_cookies', message: 'Логин прошёл, но cookies не найдены — повторите попытку.' },
          { status: 500 },
        )
      }

      const { iv, ciphertext } = encryptJson({
        cookies: hhCookies,
        capturedAt: new Date().toISOString(),
      })

      const { error: upErr } = await supabase.from('hh_sessions').upsert(
        {
          user_id: user.id,
          iv,
          ciphertext,
          hh_email: hhLogin,
          status: 'active',
          last_validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (upErr) {
        console.error('[hh/login] upsert error', upErr)
        return NextResponse.json({ error: upErr.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, hh_email: hhLogin, cookieCount: hhCookies.length })
    } finally {
      await ctx.close()
    }
  } catch (e: any) {
    console.error('[hh/login] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
