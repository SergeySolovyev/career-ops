// Tier resolution + monthly quota counting.
// Single source of truth for "what can this user do right now?".
//
// Free  → 3 AI-evaluated vacancies / 30 days, no TG channels, no recurring scans
// Pro   → unlimited evaluations, 10 TG channels, daily scans
// Premium → unlimited + priority support + custom outreach (future)
//
// Quota window is rolling 30 days (not calendar month) to avoid month-boundary
// abuse where a user signs up Jan 31, gets 3, then 3 more on Feb 1.

import type { SupabaseClient } from '@supabase/supabase-js'

export type Tier = 'free' | 'pro' | 'premium'

export const FREE_MONTHLY_QUOTA = 3
export const QUOTA_WINDOW_DAYS = 30

export type TierState = {
  tier: Tier
  status: 'active' | 'past_due' | 'canceled' | 'pending' | 'none'
  current_period_end: string | null
  // For Free: how many AI-evaluations consumed in the last 30 days.
  // For Pro/Premium: always 0 (unlimited).
  used: number
  // Hard cap. For Pro/Premium this is Infinity (returned as null over JSON).
  limit: number | null
  remaining: number | null
}

/**
 * Resolve a user's tier state. Always returns a valid TierState, even for
 * users with no subscriptions row (defaults to 'free' via RPC fallback).
 */
export async function resolveTierState(
  supabase: SupabaseClient,
  userId: string,
): Promise<TierState> {
  // 1) Tier from RPC (coalesce → 'free' if no active sub)
  const { data: tierData, error: tierErr } = await supabase.rpc('get_user_tier', {
    p_user_id: userId,
  })
  const tier: Tier = (tierErr || !tierData ? 'free' : (tierData as Tier))

  // 2) Sub row for status + period end (best-effort; RLS allows own select)
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  const status = (subRow?.status as TierState['status']) ?? 'none'
  const current_period_end = (subRow?.current_period_end as string | null) ?? null

  // 3) Quota usage (only matters for free tier; Pro/Premium = unlimited)
  if (tier === 'free') {
    const since = new Date(Date.now() - QUOTA_WINDOW_DAYS * 86_400_000).toISOString()
    // user_evaluations uses `evaluated_at` (not created_at) as the insert timestamp —
    // discovered via real customer E2E walkthrough on 2026-05-28. Without this
    // fix, any Free user gets unlimited scans because the filter excludes all rows.
    const { count } = await supabase
      .from('user_evaluations')
      .select('url', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('evaluated_at', since)

    const used = count ?? 0
    return {
      tier,
      status,
      current_period_end,
      used,
      limit: FREE_MONTHLY_QUOTA,
      remaining: Math.max(0, FREE_MONTHLY_QUOTA - used),
    }
  }

  return {
    tier,
    status,
    current_period_end,
    used: 0,
    limit: null,        // unlimited
    remaining: null,
  }
}

/**
 * Quota gate. Returns null if the user can proceed, or a structured reason
 * if blocked. The route should respond 402 (Payment Required) with this body.
 */
export function checkQuota(state: TierState): { blocked: false } | {
  blocked: true
  reason: 'free_quota_exceeded'
  message: string
  used: number
  limit: number
} {
  if (state.tier !== 'free') return { blocked: false }
  if (state.limit !== null && state.used >= state.limit) {
    return {
      blocked: true,
      reason: 'free_quota_exceeded',
      message: `Использовано ${state.used} из ${state.limit} AI-оценок за 30 дней. Оформите Pro за ₽99 в первый месяц.`,
      used: state.used,
      limit: state.limit,
    }
  }
  return { blocked: false }
}
