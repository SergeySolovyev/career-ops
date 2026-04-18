'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ScanButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ scanned: number; evaluated: number } | null>(null)

  async function handleScan() {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/scan-now', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setResult({ scanned: body.scanned, evaluated: body.evaluated })
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
      {error && <span className="text-xs text-destructive">Ошибка: {error}</span>}
    </div>
  )
}
