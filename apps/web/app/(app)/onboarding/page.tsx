'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  FileText,
  Target,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Brain,
  Check,
  AlertCircle,
} from 'lucide-react'

/* ============================================================
   VibeOffer · Onboarding
   Client component — preserves 3-step state machine, saveProfile POST,
   and /api/onboarding/first-response generation.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

type Step = 1 | 2 | 3

const STEPS = [
  { n: 1, label: 'CV', Icon: FileText },
  { n: 2, label: 'Цели', Icon: Target },
  { n: 3, label: 'AI-совет', Icon: Sparkles },
] as const

// Outer page wrapper — provides Suspense boundary required by Next.js 15
// when a client component reads URL search params. Without this, the
// production build fails at prerender stage with:
//   "useSearchParams() should be wrapped in a suspense boundary"
export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingForm />
    </Suspense>
  )
}

function OnboardingFallback() {
  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[760px] px-6 py-10">
        <div className="mb-6 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          Workspace / Onboarding
        </div>
        <div className="h-12 w-72 animate-pulse rounded-md bg-slate-100" />
        <div className="mt-10 grid grid-cols-3 gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-1 animate-pulse rounded-full bg-slate-200" />
          ))}
        </div>
        <div className="mt-12 h-96 animate-pulse rounded-md bg-slate-50" />
      </div>
    </div>
  )
}

function OnboardingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Intent passthrough from landing → signup → onboarding.
  // Mirrors the whitelist in (auth)/signup/actions.ts. After CV+goals are
  // saved, Step 3 shows an "Оформить Pro за ₽99" CTA that hits
  // /api/billing/checkout and redirects to Tinkoff PaymentURL.
  const intentRaw = searchParams.get('intent')
  const promoRaw = searchParams.get('promo')
  const intent: 'pro' | 'premium' | null =
    intentRaw === 'pro' || intentRaw === 'premium' ? intentRaw : null
  // BETA99 only applies to Pro (Premium gets no promo discount)
  const promo: 'BETA99' | null =
    promoRaw === 'BETA99' && intent === 'pro' ? promoRaw : null
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // Pricing copy lives next to the UI that uses it — single source of truth
  // for the onboarding-side checkout CTA. Server-side prices are in
  // /api/billing/checkout/route.ts PRICES — keep these in sync.
  const tierCopy = intent === 'premium'
    ? {
        bannerName: 'Premium план',
        bannerHint: 'после CV — оформление за ₽699/мес',
        ctaTitle: 'Готово — оформим Premium?',
        ctaPrice: '₽699/мес с приоритетной поддержкой и custom outreach.',
        ctaButton: 'Оформить за ₽699 →',
      }
    : {
        bannerName: 'Pro план',
        bannerHint: 'после CV — оформление за ₽99 первый месяц',
        ctaTitle: 'Готово — оформим Pro?',
        ctaPrice: '₽99 за первый месяц по промо BETA99. Дальше ₽299/мес, отмена в один клик в кабинете.',
        ctaButton: 'Оформить за ₽99 →',
      }

  async function handleCheckout() {
    if (!intent) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: intent, promo: promo ?? undefined }),
      })
      const body = await res.json()
      if (!res.ok || !body.paymentUrl) {
        // Friendly customer-facing copy — server `error: "Internal error"` is a
        // technical leak (means CloudPayments creds missing during pre-launch).
        // Hide the technical detail; offer retry + fallback to /dashboard.
        throw new Error('payment_unavailable')
      }
      // Hard navigate — CloudPayments hosts the form on their domain
      window.location.href = body.paymentUrl
    } catch (e: any) {
      // CP-ключи ещё не одобрены — мягко уводим в waitlist с сохранением
      // intent+promo. Bulk-email в день одобрения вернёт пользователя сюда же.
      if (e?.message === 'payment_unavailable') {
        const url = new URL('/waitlist', window.location.origin)
        url.searchParams.set('source', 'checkout_blocked')
        url.searchParams.set('intent', 'pro')
        url.searchParams.set('promo', 'BETA99')
        window.location.href = url.toString()
        return
      }
      setCheckoutError('Не удалось создать платёж. Попробуйте ещё раз через минуту.')
      setCheckoutLoading(false)
    }
  }

  // Step 1
  const [cv, setCv] = useState('')

  // Step 2
  const [fullName, setFullName] = useState('')
  const [targetRoles, setTargetRoles] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [icpSegment, setIcpSegment] = useState<'junior' | 'middle' | 'senior'>('middle')
  const [city, setCity] = useState('')
  const [remoteOk, setRemoteOk] = useState(true)
  const [experienceYears, setExperienceYears] = useState('')

  // Step 3
  const [firstMessage, setFirstMessage] = useState<string | null>(null)

  // On mount: read ?step=N query param and validate against actual saved progress
  // from /api/profile. Auto-skips to first incomplete step when the requested
  // step is invalid (e.g., ?step=3 without saved goals).
  // Defensive: never lets the user skip ahead beyond what they've actually saved.
  useEffect(() => {
    let cancelled = false
    async function syncStepFromProfile() {
      const requested = Number(searchParams.get('step'))
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) return
        const profile = await res.json()
        if (cancelled) return
        const hasCv = !!profile?._has_cv
        const hasGoals = !!profile?._has_goals
        // First incomplete step — fallback when no/invalid ?step= param
        const firstIncomplete: Step = !hasCv ? 1 : !hasGoals ? 2 : 3
        let target: Step = firstIncomplete
        if (requested === 2 && hasCv) target = 2
        else if (requested === 3 && hasCv && hasGoals) target = 3
        else if (requested === 1) target = 1
        // Pre-fill cv state if user already saved it (so Step 1 isn't blank
        // when navigating back via ?step=1)
        if (typeof profile?.cv_text === 'string' && profile.cv_text) {
          setCv(profile.cv_text)
        }
        // Pre-fill Step 2 fields from prior saves OR from signup metadata.
        // Without this, a returning user arrives at Step 2 with empty "Имя"
        // even though they typed it during signup — felt sloppy in PM E2E.
        // /api/profile contract: full_name under .candidate, roles+salary
        // under .target, the rest at top level (see route.ts shape).
        const cand = (profile as any)?.candidate
        const target_ = (profile as any)?.target
        if (typeof cand?.full_name === 'string' && cand.full_name) {
          setFullName(cand.full_name)
        }
        if (Array.isArray(target_?.roles) && target_.roles.length > 0) {
          setTargetRoles(target_.roles.join(', '))
        }
        if (typeof target_?.salary_min === 'number') setSalaryMin(String(target_.salary_min))
        if (typeof target_?.salary_target_max === 'number') setSalaryMax(String(target_.salary_target_max))
        if (profile?.icp_segment && ['junior', 'middle', 'senior'].includes(profile.icp_segment)) {
          setIcpSegment(profile.icp_segment)
        }
        if (typeof profile?.city === 'string' && profile.city) setCity(profile.city)
        if (typeof profile?.experience_years === 'number') {
          setExperienceYears(String(profile.experience_years))
        }
        if (typeof profile?.remote_ok === 'boolean') setRemoteOk(profile.remote_ok)
        setStep(target)
      } catch {
        // Network error — default to Step 1, no harm done
      }
    }
    syncStepFromProfile()
    return () => {
      cancelled = true
    }
    // Run once on mount; searchParams is stable for the page lifetime here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveProfile(partial: Record<string, unknown>) {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `HTTP ${res.status}`)
    }
  }

  async function handleNextStep1() {
    if (cv.trim().length < 100) {
      setError('CV слишком короткое — вставьте хотя бы 100 символов')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await saveProfile({ cv_text: cv })
      setStep(2)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleNextStep2() {
    setError(null)
    setLoading(true)
    try {
      await saveProfile({
        full_name: fullName || null,
        target_roles: targetRoles
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
        icp_segment: icpSegment,
        city: city.trim() || null,
        remote_ok: remoteOk,
        experience_years: experienceYears ? Number(experienceYears) : 0,
      })
      setStep(3)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/first-response', {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      const { message } = await res.json()
      setFirstMessage(message)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[760px] px-6 py-10">
        {/* Intent banner — shown when user came from a paid-tier CTA on landing */}
        {intent && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            <span className="font-semibold">{tierCopy.bannerName} выбран.</span>{' '}
            Заполните CV и цели (~2 мин) — {tierCopy.bannerHint}.
          </div>
        )}

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>Workspace</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">Onboarding</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Setup · 3 steps · ~2 min
          </div>
          <h1 className="mt-1 text-[26px] sm:text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
            Настроим AI-советник
          </h1>
        </div>

        {/* Progress rail */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {STEPS.map(({ n, label, Icon }) => {
            const active = step === n
            const done = step > n
            return (
              <div key={n} className="relative">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    done || active ? 'bg-slate-900' : 'bg-slate-200'
                  }`}
                />
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-md font-mono text-[10px] font-semibold transition-colors ${
                      done
                        ? 'bg-slate-900 text-white'
                        : active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done ? <Check size={10} strokeWidth={3} /> : n}
                  </span>
                  <div
                    className={`flex items-center gap-1.5 text-[12.5px] font-medium ${
                      done || active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    <Icon size={12} strokeWidth={1.8} />
                    {label}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step 1 — CV */}
        {step === 1 && (
          <section className="card p-6">
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Step 01 · CV paste
              </div>
              <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.015em]">
                Давайте познакомимся
              </h2>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-slate-500">
                Вставьте ваше CV — AI-советник использует его для персональных
                рекомендаций. Подойдёт текст, markdown или список опыта.
              </p>
            </div>

            <div className="relative">
              <textarea
                value={cv}
                onChange={(e) => setCv(e.target.value)}
                rows={14}
                placeholder={`# Иван Иванов
## Опыт
- 2024 – сейчас: Junior Frontend Developer · стартап X
  • React + TypeScript, 1.5 года
  • 5 pet-проектов на GitHub
- 2022–2024: студент МГТУ им. Баумана, ИТ-факультет
…`}
                className="w-full resize-y rounded-md border border-slate-200 bg-slate-50/40 p-4 font-mono text-[12.5px] leading-[1.55] text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
              />
              <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-500">
                <span>chars: {cv.length}</span>
                <span className={cv.length >= 100 ? 'text-emerald-600' : 'text-slate-400'}>
                  {cv.length >= 100 ? '✓ ok' : `min 100`}
                </span>
              </div>
            </div>

            {error && <ErrorLine message={error} />}

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
                privacy · stored encrypted
              </span>
              <button
                onClick={handleNextStep1}
                disabled={loading}
                className="btn-primary h-10 px-5 text-[13px]"
              >
                {loading ? 'Сохраняем…' : 'Далее'}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

        {/* Step 2 — Goals */}
        {step === 2 && (
          <section className="card p-6">
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Step 02 · Target
              </div>
              <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.015em]">
                Что ищем?
              </h2>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-slate-500">
                Целевые роли и вилка — AI будет отсеивать всё не по профилю.
              </p>
            </div>

            <div className="space-y-5">
              <Field label="Имя">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Иван Иванов"
                  className={inputCls}
                />
              </Field>

              <Field
                label="Целевые роли"
                hint="через запятую · AI сопоставит с каждой вакансией"
              >
                <input
                  type="text"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  placeholder="Frontend Junior, Middle Backend, Data Analyst"
                  className={inputCls}
                />
              </Field>

              <Field
                label="Уровень опыта"
                hint="подскажет AI, как оценивать вакансии под вас"
              >
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    { value: 'junior', label: 'Junior', sub: 'до 2 лет' },
                    { value: 'middle', label: 'Middle', sub: '2–5 лет' },
                    { value: 'senior', label: 'Senior', sub: '5+ лет' },
                  ] as const).map((opt) => {
                    const active = icpSegment === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setIcpSegment(opt.value)}
                        className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-[13px] font-medium">{opt.label}</div>
                        <div
                          className={`mt-0.5 font-mono text-[10px] ${
                            active ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {opt.sub}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Город" hint="Москва, СПб, удалёнка">
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Москва"
                    className={inputCls}
                  />
                </Field>
                <Field label="Стаж, лет">
                  <input
                    type="number"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="3"
                    min={0}
                    max={50}
                    className={inputCls + ' tabular-nums'}
                  />
                </Field>
              </div>

              <Field label="Готов к удалёнке?">
                <button
                  type="button"
                  onClick={() => setRemoteOk(!remoteOk)}
                  className={`mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors ${
                    remoteOk
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                  aria-pressed={remoteOk}
                >
                  <span
                    className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
                      remoteOk ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                        remoteOk ? 'left-3.5' : 'left-0.5'
                      }`}
                    />
                  </span>
                  {remoteOk ? 'Да, готов' : 'Только офис / гибрид'}
                </button>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Зарплата от, ₽">
                  <input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="120 000"
                    className={inputCls + ' tabular-nums'}
                  />
                </Field>
                <Field label="до, ₽">
                  <input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="220 000"
                    className={inputCls + ' tabular-nums'}
                  />
                </Field>
              </div>
            </div>

            {error && <ErrorLine message={error} />}

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                onClick={() => setStep(1)}
                className="btn-secondary h-10 px-5 text-[13px]"
              >
                <ArrowLeft size={14} />
                Назад
              </button>
              <button
                onClick={handleNextStep2}
                disabled={loading}
                className="btn-primary h-10 px-5 text-[13px]"
              >
                {loading ? 'Сохраняем…' : 'Далее'}
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
        )}

        {/* Step 3 — First AI message */}
        {step === 3 && (
          <section className="card p-6">
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Step 03 · Advisor
              </div>
              <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.015em]">
                Первый совет от AI
              </h2>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-slate-500">
                AI прочитает ваше CV и цели и предложит первый шаг на этой неделе.
              </p>
            </div>

            {!firstMessage && !loading && (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Brain size={20} />
                </div>
                <p className="text-[13.5px] text-slate-600">
                  Нажмите, чтобы AI проанализировал ваш профиль и дал первую
                  рекомендацию.
                </p>
                <button
                  onClick={handleGenerate}
                  className="btn-primary mt-5 h-10 px-5 text-[13px]"
                >
                  <Sparkles size={14} />
                  Сгенерировать первый совет
                </button>
                <div className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
                  ~5–8s · claude-sonnet-4.5
                </div>
              </div>
            )}

            {loading && (
              <div className="rounded-md border border-slate-200 bg-white p-10 text-center">
                <div className="relative mx-auto mb-4 flex h-12 w-12 items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-xl opacity-60 blur-xl"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(37,99,235,0.4) 0%, transparent 70%)',
                    }}
                  />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Brain size={20} className="animate-pulse" />
                  </span>
                </div>
                <p className="text-[13.5px] text-slate-700">
                  AI анализирует ваш профиль…
                </p>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            )}

            {firstMessage && (
              <div className="rounded-md border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-900 text-white">
                    <Sparkles size={10} />
                  </span>
                  AI карьерный консультант · claude-sonnet-4.5
                </div>
                <div className="whitespace-pre-wrap text-[14px] leading-[1.6] text-slate-800">
                  {firstMessage}
                </div>
              </div>
            )}

            {error && <ErrorLine message={error} />}

            {firstMessage && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                {/* Paid-intent path — primary CTA is checkout (Pro or Premium) */}
                {intent && (
                  <div className="mb-4 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[13px] text-emerald-900">
                      <div className="font-semibold">{tierCopy.ctaTitle}</div>
                      <div className="mt-0.5 text-[12px] text-emerald-800">
                        {tierCopy.ctaPrice}
                      </div>
                    </div>
                    <button
                      onClick={handleCheckout}
                      disabled={checkoutLoading}
                      className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {checkoutLoading ? 'Создаём платёж…' : tierCopy.ctaButton}
                    </button>
                  </div>
                )}
                {checkoutError && (
                  <ErrorLine
                    message={checkoutError}
                  />
                )}

                <div className="flex items-center justify-between">
                  {intent ? (
                    // Pay-first paradigm: при intent=pro/premium НЕТ escape hatch
                    // в /dashboard. Кто не готов — на waitlist (через checkoutError).
                    // Кто готов — checkout-кнопка выше, и она единственная.
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
                      доступ к матчам после оплаты
                    </span>
                  ) : (
                    // Пользователь без intent (organic signup) — идёт в /dashboard
                    // где сидит paywall на /matches. Это для тех кто хочет
                    // сначала осмотреться.
                    <>
                      <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
                        setup complete · entering workspace
                      </span>
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="btn-primary h-10 px-5 text-[13px]"
                      >
                        В кабинет
                        <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Subcomponents
   ------------------------------------------------------------ */

const inputCls =
  'mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {hint && (
        <span className="ml-2 font-mono text-[10px] text-slate-400">· {hint}</span>
      )}
      {children}
    </label>
  )
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-800">
      <AlertCircle size={14} className="mt-0.5 flex-none" />
      <span>{message}</span>
    </div>
  )
}
