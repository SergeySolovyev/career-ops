'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type TierState = {
  tier: 'free' | 'pro' | 'premium'
  status: 'active' | 'past_due' | 'canceled' | 'pending' | 'none'
  used: number
  limit: number | null
  remaining: number | null
}

/**
 * QuotaBanner — sits above the matches grid.
 * - Free user with quota remaining → soft counter "Осталось 2 из 3 AI-оценок"
 * - Free user at quota         → upgrade CTA with promo price
 * - Pro/Premium               → "Pro · безлимит" pill (positive reinforcement)
 *
 * Fetches /api/me/tier on mount + re-fetches whenever the parent calls
 * `bump()` via the imperative ref (after a successful scan, for example).
 */
export default function QuotaBanner() {
  const [state, setState] = useState<TierState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/me/tier')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setState(s))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // Listen for "quota-changed" events dispatched by ScanButton after a scan.
  useEffect(() => {
    function refresh() {
      fetch('/api/me/tier')
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => setState(s))
    }
    window.addEventListener('quota-changed', refresh)
    return () => window.removeEventListener('quota-changed', refresh)
  }, [])

  if (loading || !state) return null

  // Pro/Premium — confident green pill
  if (state.tier !== 'free') {
    const label = state.tier === 'pro' ? 'Pro · безлимит' : 'Premium · безлимит'
    return (
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {label}
      </div>
    )
  }

  // Free + quota exhausted — upgrade card
  if (state.remaining !== null && state.remaining <= 0) {
    return (
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-amber-900">
            Использовано {state.used} из {state.limit} AI-оценок
          </div>
          <div className="mt-0.5 text-xs text-amber-800">
            Лимит обновится через 30 дней с момента первой оценки. Или подключите Pro — безлимит и приоритетный сканер.
          </div>
        </div>
        <Link
          href="/?intent=pro&promo=BETA99#pricing"
          className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-amber-800"
        >
          Pro за ₽99
        </Link>
      </div>
    )
  }

  // Free + has quota — soft counter
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
      <span className="font-medium text-slate-900">Free</span>
      <span className="text-slate-400">·</span>
      <span>
        осталось <span className="font-semibold text-slate-900">{state.remaining}</span> из {state.limit} AI-оценок
      </span>
      <Link href="/?intent=pro&promo=BETA99#pricing" className="ml-1 text-emerald-700 hover:underline">
        Pro за ₽99 →
      </Link>
    </div>
  )
}
