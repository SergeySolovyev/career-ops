import Link from 'next/link'
import { Sparkles, LogIn, Mail, Lock, AlertCircle } from 'lucide-react'
import { signIn } from './actions'

/* ============================================================
   CareerPilot · Login
   Server component — preserves signIn action + searchParams error.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

export default async function LoginPage({
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
      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
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

        <div className="card p-6 lift">
          {/* Header */}
          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Sign in · email + password
            </div>
            <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.015em] grad-text">
              Войти в CareerPilot
            </h1>
            <p className="mt-2 text-[13.5px] leading-[1.5] text-slate-500">
              Введите email и пароль — и попадёте в свой AI-кабинет.
            </p>
          </div>

          {/* Error */}
          {params.error === 'supabase_disabled' ? (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
              <AlertCircle size={14} className="mt-0.5 flex-none" />
              <div>
                Вход в demo-режиме отключён.{' '}
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
          <form action={signIn} className="space-y-4">
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

            <Field label="Пароль" Icon={Lock}>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputCls}
              />
            </Field>

            <button
              type="submit"
              className="btn-primary h-11 w-full justify-center text-[13.5px]"
            >
              <LogIn size={14} />
              Войти
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 text-[12.5px] text-slate-500">
            <span>Нет аккаунта?</span>
            <Link
              href="/signup"
              className="font-medium text-slate-900 hover:underline"
            >
              Зарегистрироваться →
            </Link>
          </div>
        </div>

        {/* Trust line */}
        <div className="mt-5 flex items-center justify-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
          <Lock size={10} />
          TLS 1.3 · пароль хэшируется в Supabase
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
  children,
}: {
  label: string
  Icon: any
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <Icon size={11} />
        {label}
      </div>
      {children}
    </label>
  )
}
