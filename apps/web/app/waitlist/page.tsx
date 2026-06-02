import Link from 'next/link'
import { Sparkles, Mail, Check, ArrowLeft } from 'lucide-react'
import WaitlistForm from './waitlist-form'

/* ============================================================
   CareerPilot · Waitlist
   Standalone-страница на которую ссылается checkout-blocked баннер и
   пара CTA с лендинга. Принимает ?intent=pro&promo=BETA99 чтобы
   сохранить намерение пользователя — bulk-email в день одобрения CP
   отправит каждому ссылку прямо на /onboarding с восстановленным intent.
   ============================================================ */

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    intent?: string
    promo?: string
    source?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
  }>
}) {
  const params = await searchParams

  // Whitelist всех входных — иначе reflected-XSS-style загрязнение hidden-input
  const intent = params.intent === 'pro' || params.intent === 'premium' ? params.intent : null
  const promo = params.promo === 'BETA99' && intent === 'pro' ? params.promo : null
  const source = typeof params.source === 'string' ? params.source : 'other'

  // UTM — оставляем как есть, ограничивая длину чтобы не сохранять мусор
  const trunc = (s: string | undefined) => (s ? s.slice(0, 80) : null)
  const utm_source = trunc(params.utm_source)
  const utm_medium = trunc(params.utm_medium)
  const utm_campaign = trunc(params.utm_campaign)

  const headline = intent === 'pro'
    ? 'Pro за ₽99 — запуск со дня на день'
    : intent === 'premium'
    ? 'Premium-тариф открывается на следующей неделе'
    : 'Запуск со дня на день — оставьте email'

  const sub = intent === 'pro'
    ? 'Промо ₽99 действует только для первых 100 пользователей. Подпишитесь — пришлём прямую ссылку в день старта приёма платежей.'
    : 'Платёжная система активируется со дня на день. Пришлём ссылку с фиксированной ценой первого месяца, как только всё заработает.'

  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <div className="relative isolate overflow-hidden">
        {/* subtle radial backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10 grid-bg grid-fade opacity-60" />

        <div className="mx-auto flex max-w-[920px] flex-col px-6 pt-8 pb-20">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-slate-700 hover:text-slate-900">
              <ArrowLeft size={16} />
              <span className="text-sm">На главную</span>
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
                <Sparkles size={14} />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">CareerPilot</span>
            </Link>
          </div>

          {/* Hero */}
          <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Soft launch · приём платежей активируется
              </div>
              <h1 className="mt-4 text-[36px] font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
                {headline}
              </h1>
              <p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-slate-600">
                {sub}
              </p>

              <ul className="mt-8 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    AI оценивает вакансии по 10 критериям —{' '}
                    <span className="font-medium text-slate-900">Claude Sonnet 4.5</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>Сканер HH.ru + TG-каналов работает 24/7 — настройка 2 минуты</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    Pipeline-трекер откликов с напоминаниями + AI-советник по вашему CV
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>
                    Возврат 14 дней без вопросов · оферта, конфиденциальность и реквизиты —{' '}
                    <Link href="/offer" className="underline underline-offset-2">в подвале</Link>
                  </span>
                </li>
              </ul>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
                <Mail size={16} />
                <span>Email для уведомления</span>
              </div>

              <WaitlistForm
                intent={intent}
                promo={promo}
                source={source}
                utm_source={utm_source}
                utm_medium={utm_medium}
                utm_campaign={utm_campaign}
              />

              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Подписываясь, вы соглашаетесь получить одно письмо в день старта приёма платежей.
                Никакого спама — отписаться можно одним кликом. Регулируется{' '}
                <Link href="/privacy" className="underline underline-offset-2">
                  Политикой конфиденциальности
                </Link>{' '}
                (152-ФЗ).
              </p>
            </div>
          </div>

          {/* Social proof / FAQ short */}
          <div className="mt-20 grid gap-6 sm:grid-cols-3">
            <FactCard
              kpi="89"
              label="вакансий проверено AI в демо"
              hint="источник: HH.ru, последние 24 часа"
            />
            <FactCard
              kpi="10"
              label="критериев оценки"
              hint="скиллы, ICP, дистанция до требований, реалистичность"
            />
            <FactCard
              kpi="₽99"
              label="первый месяц для первых 100"
              hint="дальше — ₽490/мес, без скрытых платежей"
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function FactCard({ kpi, label, hint }: { kpi: string; label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-2xl font-semibold tabular-nums text-slate-900">{kpi}</div>
      <div className="mt-1 text-sm text-slate-700">{label}</div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  )
}
