'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Loader2 } from 'lucide-react'
import { showToast } from '@/lib/toast'

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
    showToast({
      kind: 'info',
      message: 'Сканируем TG-каналы… обычно 20–40 секунд.',
      durationMs: 4000,
    })
    try {
      const res = await fetch('/api/tg/scan-now', { method: 'POST' })
      const body = await res.json()
      // 503 + reason 'tg_worker_unavailable' = friendly "coming soon"
      if (res.status === 503 && body?.reason === 'tg_worker_unavailable') {
        showToast({
          kind: 'info',
          message: body.message || 'Telegram-сканер скоро будет включён.',
          durationMs: 5000,
        })
        return
      }
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      if (body.blockedByQuota) {
        const msg = `Месячный лимит на AI исчерпан ($${(body.monthSpend ?? 0).toFixed(2)} / $3). Сбросится через 30 дней.`
        setError(msg)
        showToast({ kind: 'error', message: msg, durationMs: 6000 })
      } else {
        setReport(body.report)
        const n = body.report?.newRows ?? 0
        const dup = body.report?.duplicates ?? 0
        showToast({
          kind: 'success',
          message:
            n > 0
              ? `Найдено ${n} новых вакансий (дублей: ${dup}).`
              : `Новых вакансий не найдено (дублей: ${dup}).`,
          durationMs: 5000,
        })
        router.refresh()
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Не удалось запустить сканер'
      setError(msg)
      showToast({ kind: 'error', message: msg, durationMs: 6000 })
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
