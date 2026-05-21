'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO Day 6: pipe to Sentry
    console.error('[(app) boundary]', error)
  }, [error])

  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[600px] px-6 py-20 text-center">
        <AlertTriangle size={48} className="mx-auto text-amber-500" />
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">
          Что-то сломалось
        </h1>
        <p className="mt-3 text-[14px] leading-[1.6] text-slate-500">
          Мы получили сообщение об ошибке. Если повторится — напишите нам в чат.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-slate-400">
            error: {error.digest}
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-slate-800"
          >
            <RefreshCw size={14} />
            Попробовать снова
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-900 hover:bg-slate-50"
          >
            На дашборд
          </Link>
        </div>
      </div>
    </div>
  )
}
