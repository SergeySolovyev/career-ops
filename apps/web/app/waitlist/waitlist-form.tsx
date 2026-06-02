'use client'

import { useState, useTransition } from 'react'
import { Mail, Check, AlertCircle, Loader2 } from 'lucide-react'
import { addToWaitlist } from './actions'

interface Props {
  intent: string | null
  promo: string | null
  source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

type Status =
  | { kind: 'idle' }
  | { kind: 'success'; alreadyExisted: boolean }
  | { kind: 'error'; message: string }

/**
 * Client-side обёртка над Server Action для приёма email в waitlist.
 *
 * Почему клиентский компонент: нужен useTransition() для loading-spinner,
 * локальный state для post-submit confirmation, без полного перерендера
 * страницы. Server Action всё равно бежит на сервере — это просто RPC.
 */
export default function WaitlistForm(props: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    // Прикрепляем hidden-поля из URL search params чтобы Server Action
    // получил полный контекст ОДНИМ вызовом без отдельного round-trip
    if (props.intent) formData.set('intent', props.intent)
    if (props.promo) formData.set('promo', props.promo)
    formData.set('source', props.source)
    if (props.utm_source) formData.set('utm_source', props.utm_source)
    if (props.utm_medium) formData.set('utm_medium', props.utm_medium)
    if (props.utm_campaign) formData.set('utm_campaign', props.utm_campaign)

    startTransition(async () => {
      const result = await addToWaitlist(formData)
      if (result.ok) {
        setStatus({ kind: 'success', alreadyExisted: result.alreadyExisted })
      } else {
        setStatus({ kind: 'error', message: result.error })
      }
    })
  }

  if (status.kind === 'success') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <div className="flex items-center gap-2 font-medium">
          <Check size={16} />
          {status.alreadyExisted
            ? 'Вы уже в списке — спасибо!'
            : 'Готово — вы в списке ✉️'}
        </div>
        <p className="mt-1 text-emerald-800">
          Пришлём письмо в день старта приёма платежей. Ничего больше — обещаем.
        </p>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Mail size={16} />
        </span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          disabled={pending}
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
          aria-label="Email для уведомления о запуске"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Добавляем…
          </>
        ) : (
          <>
            {props.intent === 'pro' ? 'Уведомить когда откроется Pro ₽99' : 'Уведомить о запуске'}
          </>
        )}
      </button>

      {status.kind === 'error' && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}
    </form>
  )
}
