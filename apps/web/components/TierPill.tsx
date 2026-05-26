'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type TierState = {
  tier: 'free' | 'pro' | 'premium'
  remaining: number | null
}

/**
 * Tiny tier indicator for the workspace sidebar.
 * - Free → "Free · 2/3" with subtle upgrade link
 * - Pro/Premium → green pill, no upgrade link
 *
 * Re-fetches on 'quota-changed' event (dispatched by /matches ScanButton)
 * so the counter stays accurate without a page refresh.
 */
export default function TierPill() {
  const [state, setState] = useState<TierState | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetch('/api/me/tier')
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => alive && setState(s))
        .catch(() => {})
    load()
    window.addEventListener('quota-changed', load)
    return () => {
      alive = false
      window.removeEventListener('quota-changed', load)
    }
  }, [])

  if (!state) return null

  if (state.tier === 'pro' || state.tier === 'premium') {
    const label = state.tier === 'pro' ? 'Pro' : 'Premium'
    return (
      <div className="mx-3 mb-2 inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {label}
      </div>
    )
  }

  // Free — show remaining + soft upgrade link
  return (
    <div className="mx-3 mb-2 flex items-center justify-between gap-2 text-[10.5px] text-slate-500">
      <span>
        <span className="font-semibold text-slate-700">Free</span>
        {state.remaining !== null && (
          <span className="text-slate-400"> · {state.remaining}/3</span>
        )}
      </span>
      <Link
        href="/?intent=pro&promo=BETA99#pricing"
        className="font-semibold text-emerald-700 hover:underline"
      >
        Pro →
      </Link>
    </div>
  )
}
