'use client'

import { useEffect, useState } from 'react'
import type { ToastPayload } from '@/lib/toast'

type Toast = ToastPayload & { id: number }

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<ToastPayload>).detail
      const id = Date.now() + Math.random()
      setToasts((t) => [...t, { ...detail, id }])
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        detail.durationMs ?? 5000,
      )
    }
    window.addEventListener('careerpilot:toast', handle)
    return () => window.removeEventListener('careerpilot:toast', handle)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          aria-live="polite"
          className={`rounded-md px-4 py-3 shadow-lg text-[13px] font-medium ${
            t.kind === 'error'
              ? 'bg-red-50 text-red-900 border border-red-200'
              : t.kind === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-slate-50 text-slate-900 border border-slate-200'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
