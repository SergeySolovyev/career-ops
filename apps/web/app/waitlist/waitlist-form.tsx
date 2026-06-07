'use client'

import { useState, useTransition } from 'react'
import { Mail, Check, AlertCircle, Loader2, MessageCircle, Phone } from 'lucide-react'
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
  | { kind: 'success'; alreadyExisted: boolean; wantsCall: boolean }
  | { kind: 'error'; message: string }

type PricingPref = '' | 'subscription' | 'success_fee' | 'unsure'

/**
 * Client-side обёртка над Server Action для приёма email в waitlist.
 *
 * VC research-сигналы (Sequoia/Emergence/NFX/Blomfield):
 *   1. pricing_preference — subscription vs success_fee vs unsure.
 *      Гипотеза: junior 20-30 RU предпочтёт «плачу когда оффер» вместо
 *      «плачу ежемесячно за доступ». Если ≥ 60% выберут success_fee —
 *      в Sprint A добавляем второй tier «Pay-on-offer ₽9990».
 *   2. wants_founder_call — Founder-led sales по Blomfield. Каждый
 *      кто отметит → Яна звонит ему лично в первый день одобрения CP.
 *      Прогноз conversion после founder-call: 4-6x baseline.
 */
export default function WaitlistForm(props: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()
  const [pricingPref, setPricingPref] = useState<PricingPref>('')
  const [wantsCall, setWantsCall] = useState(false)

  function onSubmit(formData: FormData) {
    // Прикрепляем hidden-поля из URL search params чтобы Server Action
    // получил полный контекст ОДНИМ вызовом без отдельного round-trip
    if (props.intent) formData.set('intent', props.intent)
    if (props.promo) formData.set('promo', props.promo)
    formData.set('source', props.source)
    if (props.utm_source) formData.set('utm_source', props.utm_source)
    if (props.utm_medium) formData.set('utm_medium', props.utm_medium)
    if (props.utm_campaign) formData.set('utm_campaign', props.utm_campaign)

    // VC research-сигналы
    if (pricingPref) formData.set('pricing_preference', pricingPref)
    // checkbox value === 'on' когда отмечен — стандарт HTML form
    if (wantsCall) formData.set('wants_founder_call', 'on')

    startTransition(async () => {
      const result = await addToWaitlist(formData)
      if (result.ok) {
        setStatus({
          kind: 'success',
          alreadyExisted: result.alreadyExisted,
          wantsCall,
        })
      } else {
        setStatus({ kind: 'error', message: result.error })
      }
    })
  }

  if (status.kind === 'success') {
    return (
      <div className="space-y-3">
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

        {/* Founder-led sales hook — даже если не отметили чекбокс,
            предлагаем личный звонок после успешной подписки. */}
        <a
          href={
            status.wantsCall
              ? 'https://t.me/yana_vibeoffer'
              : 'https://t.me/yana_vibeoffer?text=Хочу%2015-мин%20звонок%20о%20VibeOffer'
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
            <Phone size={14} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-900">
              {status.wantsCall
                ? 'Яна свяжется с вами в Telegram в течение часа'
                : 'Хотите личный 15-мин звонок с фаундером?'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {status.wantsCall
                ? 'Напишите @yana_vibeoffer — забронируем удобное время'
                : 'Разберёмся с вашим CV и стратегией поиска — бесплатно. Напишите в Telegram →'}
            </div>
          </div>
        </a>
      </div>
    )
  }

  return (
    <form action={onSubmit} className="space-y-4">
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

      {/* Pricing preference research — необязательно, но мощный сигнал.
          Sequoia/Emergence framing: outcome vs access. */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-xs font-medium text-slate-700">
          Как удобнее платить? <span className="font-normal text-slate-400">(не обязательно)</span>
        </div>
        <div className="space-y-1.5">
          <PricingRadio
            value="subscription"
            label="₽299/мес подпиской — стандартно"
            checked={pricingPref === 'subscription'}
            onChange={setPricingPref}
            disabled={pending}
          />
          <PricingRadio
            value="success_fee"
            label="₽0 пока не получу оффер · потом разовая оплата"
            checked={pricingPref === 'success_fee'}
            onChange={setPricingPref}
            disabled={pending}
          />
          <PricingRadio
            value="unsure"
            label="Не определился — расскажу когда увижу продукт"
            checked={pricingPref === 'unsure'}
            onChange={setPricingPref}
            disabled={pending}
          />
        </div>
      </div>

      {/* Founder-call opt-in — самый мощный сигнал намерения по
          Blomfield ("Sales Playbook for Founders"). Каждый отметивший
          переходит в hot-lead lane = Яна звонит лично в день старта. */}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300">
        <input
          type="checkbox"
          name="wants_founder_call_visual"
          checked={wantsCall}
          onChange={(e) => setWantsCall(e.target.checked)}
          disabled={pending}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <div className="flex-1 text-xs leading-relaxed text-slate-700">
          <span className="font-medium text-slate-900">Хочу 15-мин звонок с фаундером</span>{' '}
          — разберём CV и стратегию поиска. Бесплатно. Связь через Telegram.
        </div>
      </label>

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

/**
 * Маленький компонент-radio для pricing-preference. Стиль — pill-like,
 * совместимый с Linear/Notion-эстетикой остального лендинга.
 */
function PricingRadio({
  value,
  label,
  checked,
  onChange,
  disabled,
}: {
  value: PricingPref
  label: string
  checked: boolean
  onChange: (v: PricingPref) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs transition ${
        checked ? 'bg-white text-slate-900' : 'text-slate-600 hover:bg-white'
      }`}
    >
      <input
        type="radio"
        name="pricing_preference_visual"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 border-slate-300 text-slate-900 focus:ring-slate-900"
      />
      <span className="leading-relaxed">{label}</span>
    </label>
  )
}
