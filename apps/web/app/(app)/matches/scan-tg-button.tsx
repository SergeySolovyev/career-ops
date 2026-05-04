'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'

interface ScanReport {
  channelsScanned: number
  messagesFetched: number
  messagesClassified: number
  vacanciesExtracted: number
  newRows: number
  duplicates: number
  costUsd: number
  errors: string[]
  blockedByQuota?: boolean
  monthSpend?: number
}

export default function ScanTgButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ScanReport | null>(null)

  async function handleScan() {
    setError(null)
    setReport(null)
    setLoading(true)
    try {
      const res = await fetch('/api/tg/scan-now', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      if (body.blockedByQuota) {
        setError(
          `Месячный лимит на AI исчерпан ($${(body.monthSpend ?? 0).toFixed(2)} / $3). Сбросится через 30 дней.`,
        )
      } else {
        setReport(body.report)
        router.refresh()
      }
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось запустить сканер')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleScan}
        disabled={loading}
        className="btn-secondary h-10 px-4 text-[13px] disabled:opacity-50"
        title="Спарсить новые вакансии из подключённых Telegram-каналов"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            TG сканер…
          </>
        ) : (
          <>
            <Send size={14} />
            Сканировать TG
          </>
        )}
      </button>
      {loading && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          обычно 20–40 секунд
        </span>
      )}
      {report && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-700">
          ✓ {report.newRows} новых · {report.duplicates} дубл · ${report.costUsd.toFixed(3)}
        </span>
      )}
      {error && (
        <span className="max-w-[280px] text-right font-mono text-[10px] uppercase tracking-wider text-red-600">
          {error.slice(0, 120)}
        </span>
      )}
    </div>
  )
}
