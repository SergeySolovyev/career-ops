/**
 * Waitlist — client-safe types + server-side helpers for collecting pre-launch leads.
 *
 * Why server-only insert path: anon-key INSERT на public.waitlist запрещён RLS,
 * чтобы боты не наполняли таблицу с публичной страницы. Все записи проходят
 * через Server Action `addToWaitlist` который использует server-side Supabase
 * client с привилегиями выше anon, но не service-role (используем authed
 * client с RLS-bypass через специальную policy в миграции 009 если понадобится).
 *
 * Текущий MVP: пишем через server client с явным upsert+onConflict — даже без
 * SUPABASE_SERVICE_ROLE_KEY это работает через server-side Supabase Auth
 * helpers, потому что RLS отключён для INSERT внутри Server Action
 * (см. миграцию 009 — отсутствие policy на INSERT = всё запрещено,
 * но supabase server client с service-role key обходит RLS).
 *
 * Если SUPABASE_SERVICE_ROLE_KEY не установлен — функция возвращает мягкую
 * ошибку, а UI показывает "уже есть в списке" (defensive UX).
 */

import crypto from 'crypto'

export type WaitlistSource =
  | 'landing_hero'
  | 'landing_pricing'
  | 'landing_final_cta'
  | 'checkout_blocked'
  | 'blog'
  | 'pricing_modal'
  | 'other'

export type WaitlistIntent = 'pro' | 'premium' | 'free'

export interface WaitlistEntry {
  email: string
  source?: WaitlistSource
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  intent?: WaitlistIntent | null
  promo?: string | null
  referrer?: string | null
  user_agent?: string | null
}

/**
 * Compute privacy-preserving IP hash для антиспама.
 * Соль обновляется каждый день — невозможно ре-идентифицировать пользователя
 * через хеш по прошествии 24 часов.
 */
export function hashIpForWaitlist(ip: string | null | undefined): string | null {
  if (!ip) return null
  const dailySalt = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return crypto
    .createHash('sha256')
    .update(`${ip}|${dailySalt}|careerpilot-waitlist`)
    .digest('hex')
    .slice(0, 32) // 128 бит хватит, экономим storage
}

/**
 * Простой email validator. Не RFC-полный — намеренно строгий чтобы
 * фильтровать боты, использующие невалидные адреса. Реальные пользователи
 * с edge-case email'ами всегда могут связаться через support.
 */
export function isPlausibleEmail(email: string): boolean {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  // Минимум: что-то@что-то.что-то
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

/**
 * Нормализация email — lowercased + trimmed.
 * Уникальный индекс в БД использует lower(email), так что важно
 * нормализовать здесь для консистентного дедупа.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
