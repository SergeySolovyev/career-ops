'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
   CareerPilot · Onboarding
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

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [cv, setCv] = useState('')

  // Step 2
  const [fullName, setFullName] = useState('')
  const [targetRoles, setTargetRoles] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')

  // Step 3
  const [firstMessage, setFirstMessage] = useState<string | null>(null)

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
    <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[760px] px-6 py-10">
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
          <h1 className="mt-1 text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
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
- 2020–2026: Senior Data Scientist в Компании X
  • Построил ML-модель, снижение дефолтов на 15%
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
                  placeholder="Senior Data Scientist, ML Engineer, AI Product Manager"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Зарплата от, ₽">
                  <input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="300 000"
                    className={inputCls + ' tabular-nums'}
                  />
                </Field>
                <Field label="до, ₽">
                  <input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="800 000"
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
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
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
