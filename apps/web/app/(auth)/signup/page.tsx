import Link from 'next/link'
import {
  Sparkles,
  UserPlus,
  User,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { signUp } from './actions'

/* ============================================================
   CareerPilot · Signup
   Server component — preserves signUp action + searchParams error.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

const PERKS = [
  'AI оценивает вакансии по 10 критериям',
  'Персональный cover-letter под каждую вакансию',
  'Авто-отклик через HH (одним кликом)',
  'AI-советник знает ваш CV и матчи',
] as const

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 text-slate-900 antialiased">
      {/* Subtle background grid */}
      <div className="pointer-events-none absolute inset-0 grid-bg grid-fade opacity-60" />

      {/* Card */}
      <div className="relative grid w-full max-w-[860px] gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: value prop */}
        <div className="hidden lg:flex lg:flex-col lg:justify-center lg:pr-4">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-slate-900 hover:opacity-80"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
              <Sparkles size={14} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold tracking-tight">
                CareerPilot
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                workspace · v4.2
              </span>
            </div>
          </Link>

          <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Free plan · 3 AI оценки в месяц · без карты
          </div>
          <h1 className="mt-2 text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
            AI найдёт работу
            <br />
            за вас
          </h1>
          <p className="mt-4 max-w-[420px] text-[14px] leading-[1.55] text-slate-500">
            Загрузите CV — система 24/7 сканирует вакансии, оценивает AI,
            генерирует tailored cover-letter и откликается автоматически.
          </p>

          <ul className="mt-6 space-y-2">
            {PERKS.map((perk) => (
              <li
                key={perk}
                className="flex items-start gap-2 text-[13px] text-slate-700"
              >
                <span className="check mt-0.5">
                  <CheckCircle2 size={10} />
                </span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
            <span className="pulse-dot" />
            109 вакансий · 17 AI-рекомендаций · 4 отклика (live stats)
          </div>
        </div>

        {/* Right: form */}
        <div className="w-full">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-slate-900 lg:hidden"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
              <Sparkles size={14} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[14px] font-semibold tracking-tight">
                CareerPilot
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                workspace · v4.2
              </span>
            </div>
          </Link>

          <div className="card p-6 lift">
            {/* Header */}
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Sign up · free plan
              </div>
              <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.015em] grad-text">
                Создать аккаунт
              </h2>
              <p className="mt-2 text-[13px] leading-[1.5] text-slate-500">
                Бесплатно · 3 AI-оценки в месяц · без карты.
              </p>
            </div>

            {/* Error */}
            {params.error === 'supabase_disabled' ? (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
                <AlertCircle size={14} className="mt-0.5 flex-none" />
                <div>
                  Регистрация в demo-режиме отключена.{' '}
                  <Link href="/dashboard" className="font-semibold underline">
                    Открыть демо-кабинет →
                  </Link>
                </div>
              </div>
            ) : params.error ? (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-800">
                <AlertCircle size={14} className="mt-0.5 flex-none" />
                <span>{params.error}</span>
              </div>
            ) : null}

            {/* Form */}
            <form action={signUp} className="space-y-4">
              <Field label="Имя" Icon={User}>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Иван Иванов"
                  className={inputCls}
                />
              </Field>

              <Field label="Email" Icon={Mail}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Пароль" Icon={Lock} hint="минимум 8 символов">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>

              <button
                type="submit"
                className="btn-primary h-11 w-full justify-center text-[13.5px]"
              >
                <UserPlus size={14} />
                Создать аккаунт
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-[12.5px] text-slate-500">
              <span>Уже есть аккаунт?</span>
              <Link
                href="/login"
                className="font-medium text-slate-900 hover:underline"
              >
                Войти →
              </Link>
            </div>
          </div>

          {/* Trust line */}
          <div className="mt-5 flex items-center justify-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
            <Lock size={10} />
            TLS 1.3 · Supabase Auth · пароль хэшируется
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Subcomponents
   ------------------------------------------------------------ */

const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100'

function Field({
  label,
  Icon,
  hint,
  children,
}: {
  label: string
  Icon: any
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={11} className="text-slate-500" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {hint && (
          <span className="font-mono text-[10px] text-slate-400">· {hint}</span>
        )}
      </div>
      {children}
    </label>
  )
}
