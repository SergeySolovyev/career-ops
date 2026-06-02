'use server'

import { headers } from 'next/headers'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import {
  hashIpForWaitlist,
  isPlausibleEmail,
  normalizeEmail,
  type WaitlistEntry,
  type WaitlistIntent,
  type WaitlistSource,
} from '@/lib/waitlist'

const VALID_SOURCES: WaitlistSource[] = [
  'landing_hero',
  'landing_pricing',
  'landing_final_cta',
  'checkout_blocked',
  'blog',
  'pricing_modal',
  'other',
]

const VALID_INTENTS: WaitlistIntent[] = ['pro', 'premium', 'free']

export type WaitlistResult =
  | { ok: true; alreadyExisted: boolean }
  | { ok: false; error: string }

/**
 * Server Action — приём emails в waitlist.
 *
 * Стратегия дедупа: ON CONFLICT (lower(email)) DO NOTHING + повторный
 * select для определения "уже был" — даёт UI возможность показать
 * дружелюбное "Вы уже в списке, ждите письма ✉️" вместо ошибки.
 *
 * Анти-бот: server-side email validation + IP hash для rate-limit
 * (не реализуем здесь — Upstash rate-limit на уровне Vercel middleware).
 */
export async function addToWaitlist(formData: FormData): Promise<WaitlistResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Сервис временно недоступен. Попробуйте через минуту.' }
  }

  const rawEmail = (formData.get('email') as string) || ''
  if (!isPlausibleEmail(rawEmail)) {
    return { ok: false, error: 'Похоже, email указан с опечаткой. Проверьте, пожалуйста.' }
  }

  const email = normalizeEmail(rawEmail)
  const rawSource = (formData.get('source') as string) || 'other'
  const source: WaitlistSource = (VALID_SOURCES as string[]).includes(rawSource)
    ? (rawSource as WaitlistSource)
    : 'other'

  const rawIntent = (formData.get('intent') as string) || ''
  const intent: WaitlistIntent | null = (VALID_INTENTS as string[]).includes(rawIntent)
    ? (rawIntent as WaitlistIntent)
    : null

  const promo = (formData.get('promo') as string) || null
  const utm_source = (formData.get('utm_source') as string) || null
  const utm_medium = (formData.get('utm_medium') as string) || null
  const utm_campaign = (formData.get('utm_campaign') as string) || null

  // Заголовки берём из next/headers — referrer и user-agent для аналитики
  const h = await headers()
  const referrer = h.get('referer')
  const user_agent = h.get('user-agent')

  // Реальный IP клиента приходит через x-forwarded-for на Vercel. Берём первый
  // (последующие — IP прокси Vercel). Хешируем с дневной солью.
  const fwd = h.get('x-forwarded-for') || ''
  const clientIp = fwd.split(',')[0]?.trim() || null
  const ip_hash = hashIpForWaitlist(clientIp)

  const entry: WaitlistEntry & { ip_hash: string | null } = {
    email,
    source,
    intent,
    promo,
    utm_source,
    utm_medium,
    utm_campaign,
    referrer,
    user_agent,
    ip_hash,
  }

  try {
    const supabase = await createClient()

    // Сначала проверяем — есть ли уже такой email. Если есть — мягко возвращаем
    // alreadyExisted=true без апдейта (чтобы не перезаписать source первой записи).
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return { ok: true, alreadyExisted: true }
    }

    const { error } = await supabase.from('waitlist').insert(entry)

    if (error) {
      // 23505 = unique_violation (race condition — другой запрос вставил
      // запись между нашими select и insert). Трактуем как "уже был".
      if ((error as any).code === '23505') {
        return { ok: true, alreadyExisted: true }
      }
      console.error('[waitlist] insert error', error)
      return { ok: false, error: 'Не удалось сохранить email. Попробуйте через минуту.' }
    }

    return { ok: true, alreadyExisted: false }
  } catch (e: any) {
    console.error('[waitlist] unexpected error', e)
    return { ok: false, error: 'Сервис временно недоступен. Попробуйте через минуту.' }
  }
}
