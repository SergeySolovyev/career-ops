'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ScanButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quotaBlocked, setQuotaBlocked] = useState<{
    message: string
    upgradeUrl: string
  } | null>(null)
  const [result, setResult] = useState<{ scanned: number; evaluated: number } | null>(null)

  async function handleScan() {
    setError(null)
    setQuotaBlocked(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/scan-now', { method: 'POST' })
      const body = await res.json()
      // 402 = quota exceeded → show upgrade CTA, not generic error
      if (res.status === 402) {
        setQuotaBlocked({
          message: body.error || 'Лимит AI-оценок исчерпан',
          upgradeUrl: body.upgradeUrl || '/?intent=pro&promo=BETA99#pricing',
        })
        return
      }
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setResult({ scanned: body.scanned, evaluated: body.evaluated })
      // Tell QuotaBanner (and anyone else listening) to re-fetch tier state
      window.dispatchEvent(new CustomEvent('quota-changed'))
      // Refresh server component to render new evaluations
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleScan}
        disabled={loading}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {loading ? '🔎 AI сканирует hh.ru…' : '🔎 Найти вакансии'}
      </button>
      {loading && (
        <span className="text-xs text-muted-foreground animate-pulse">
          Это займёт 30–60 секунд
        </span>
      )}
      {result && (
        <span className="text-xs text-green-700">
          ✓ Просканировано {result.scanned}, оценено {result.evaluated}
        </span>
      )}
      {quotaBlocked && (
        <div className="flex max-w-[260px] flex-col items-end gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-right">
          <span className="text-xs text-amber-900">{quotaBlocked.message}</span>
          <Link
            href={quotaBlocked.upgradeUrl}
            className="rounded-md bg-amber-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-800"
          >
            Pro за ₽99 →
          </Link>
        </div>
      )}
      {error && <span className="text-xs text-destructive">Ошибка: {error}</span>}
    </div>
  )
}
