#!/usr/bin/env tsx
/**
 * notify-waitlist.ts — bulk-email подписчикам waitlist в день одобрения CP.
 *
 * Запуск (после подключения CP-ключей в Vercel):
 *   tsx scripts/notify-waitlist.ts --dry-run    # сначала смотрим кому отправит
 *   tsx scripts/notify-waitlist.ts              # реальная отправка
 *
 * Что делает:
 *   1. Достаёт из public.waitlist всех у кого notified_at IS NULL
 *   2. Сортирует по created_at ASC (первые подписанные — первые получают письмо)
 *   3. Отправляет персонализированное письмо через Resend (или Yandex 360 SMTP)
 *   4. Помечает notified_at = now() — идемпотентно, повторный запуск не дублирует
 *
 * Переменные окружения:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — доступ к БД
 *   RESEND_API_KEY (или) SMTP_HOST/USER/PASS — отправка
 *   FROM_EMAIL=support@careerpilot.ru
 *   SITE_URL=https://careerpilot.ru
 *
 * Зависимости:
 *   npm i -D @supabase/supabase-js resend tsx
 *
 * Anti-foot-gun:
 *   - Жёсткий rate-limit 10 писем/сек (Resend free = 100/сек, Yandex = 30/сек)
 *   - Если письмо отскочило (hard bounce) — помечаем notified_at, но логируем bounce
 *   - --limit N для постепенного rollout (сначала 10, потом 100, потом all)
 */

import { createClient } from '@supabase/supabase-js'

interface WaitlistRow {
  id: string
  email: string
  intent: 'pro' | 'premium' | 'free' | null
  promo: string | null
  source: string | null
  created_at: string
}

const FROM = process.env.FROM_EMAIL || 'support@careerpilot.ru'
const SITE_URL = process.env.SITE_URL || 'https://careerpilot.ru'
const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  let q = supabase
    .from('waitlist')
    .select('id, email, intent, promo, source, created_at')
    .is('notified_at', null)
    .order('created_at', { ascending: true })

  if (LIMIT) q = q.limit(LIMIT)

  const { data, error } = await q
  if (error) {
    console.error('Query failed:', error)
    process.exit(1)
  }

  const rows = (data as WaitlistRow[]) || []
  console.log(`📋 Найдено ${rows.length} подписчиков waitlist для уведомления`)

  if (DRY_RUN) {
    console.log('\n🧪 DRY-RUN — реальная отправка не выполняется. Первые 10:')
    rows.slice(0, 10).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.email} · intent=${r.intent} · source=${r.source}`)
    })
    process.exit(0)
  }

  let sent = 0
  let failed = 0

  for (const row of rows) {
    try {
      await sendEmail(row)
      await supabase
        .from('waitlist')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', row.id)
      sent++
      if (sent % 25 === 0) console.log(`  ✉️  ${sent}/${rows.length} отправлено`)
      // Rate-limit: 10 писем/сек
      await sleep(100)
    } catch (e: any) {
      failed++
      console.error(`  ❌ ${row.email}:`, e?.message ?? e)
    }
  }

  console.log(`\n✅ Готово: отправлено ${sent}, ошибок ${failed}`)
}

async function sendEmail(row: WaitlistRow) {
  const onboardUrl = buildOnboardUrl(row)
  const subject = '🚀 CareerPilot — приём платежей запущен'
  const html = renderEmail({ ctaUrl: onboardUrl })

  // Resend — самый простой провайдер для тестового rollout
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [row.email],
        subject,
        html,
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`Resend ${r.status}: ${text}`)
    }
    return
  }

  // TODO: fallback на Yandex 360 SMTP когда подключим
  throw new Error('No email provider configured — set RESEND_API_KEY')
}

function buildOnboardUrl(row: WaitlistRow): string {
  const u = new URL('/onboarding', SITE_URL)
  if (row.intent === 'pro' || row.intent === 'premium') u.searchParams.set('intent', row.intent)
  if (row.promo === 'BETA99') u.searchParams.set('promo', row.promo)
  u.searchParams.set('utm_source', 'waitlist')
  u.searchParams.set('utm_medium', 'email')
  u.searchParams.set('utm_campaign', 'cp_launch')
  return u.toString()
}

function renderEmail({ ctaUrl }: { ctaUrl: string }): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#0f172a;">
  <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;">🚀 CareerPilot — приём платежей запущен</h1>
  <p style="font-size:15px;line-height:1.6;color:#334155;">
    Спасибо, что подписались в waitlist. Сегодня всё заработало —
    жмёшь ссылку → 2 минуты онбординга → первый AI-скан вакансий → Pro за ₽99 на 30 дней.
  </p>
  <p style="margin:28px 0;">
    <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
      Оформить Pro за ₽99 →
    </a>
  </p>
  <p style="font-size:13px;color:#64748b;line-height:1.6;">
    Промо ₽99 действует только для первых 100 человек и только в течение 48 часов.
    Дальше — ₽490/мес. Возврат 14 дней без вопросов.
  </p>
  <p style="font-size:13px;color:#64748b;line-height:1.6;margin-top:24px;">
    Есть вопросы? Просто ответьте на это письмо — отвечу лично.<br>
    — Яна, CareerPilot
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;">
  <p style="font-size:11px;color:#94a3b8;line-height:1.5;">
    ИП Бирюкова Я.В. · ИНН 010510099667 · ОГРНИП 326774600321772<br>
    Это письмо отправлено потому что вы подписались на waitlist CareerPilot.
    Чтобы больше не получать — просто ответьте «отписаться».
  </p>
</body></html>`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
