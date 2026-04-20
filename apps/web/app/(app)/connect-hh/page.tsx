'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plug,
  Shield,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Info,
} from 'lucide-react'

/* ============================================================
   CareerPilot · Connect HH
   Client component — preserves /api/hh/login POST + /api/hh/session-status GET.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

export default function ConnectHHPage() {
  const router = useRouter()
  const [hhLogin, setHhLogin] = useState('')
  const [hhPassword, setHhPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [existing, setExisting] = useState<{
    hh_email?: string | null
    status?: string
  } | null>(null)

  useEffect(() => {
    fetch('/api/hh/session-status')
      .then((r) => r.json())
      .then((j) => setExisting(j.connected ? j : null))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const r = await fetch('/api/hh/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hh_login: hhLogin, hh_password: hhPassword }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message || j.error || `HTTP ${r.status}`)
      setDone(true)
      setHhPassword('')
      setTimeout(() => router.push('/matches'), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[680px] px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>Аккаунт</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">Подключить HH</span>
        </div>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-slate-900 text-white">
              <Plug size={17} />
            </span>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Integration · hh.ru
              </div>
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.015em]">
                Подключить HH-аккаунт
              </h1>
            </div>
          </div>
          <p className="mt-3 max-w-[560px] text-[14px] leading-[1.55] text-slate-500">
            Чтобы CareerPilot сканировал вакансии и отправлял отклики от вашего
            имени, нужно один раз войти в hh.ru через наш безопасный бэкенд.
          </p>
        </header>

        {/* Already connected */}
        {existing && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2
              size={16}
              className="mt-0.5 flex-none text-emerald-600"
            />
            <div className="flex-1 text-[13px] text-emerald-900">
              <div className="font-medium">
                HH-аккаунт уже подключён
                {existing.hh_email ? (
                  <span className="ml-1 font-mono text-[12px] text-emerald-700">
                    ({existing.hh_email})
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-emerald-700">
                Можно обновить сессию ниже, если HH разлогинил.
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer card */}
        <div className="card mb-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-50/60 px-4 py-2.5">
            <AlertTriangle size={13} className="text-amber-700" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-amber-900">
              Важно про безопасность
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {SECURITY_POINTS.map((pt, i) => (
              <li key={i} className="flex gap-3 px-4 py-3">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-slate-100">
                  <pt.Icon size={11} className="text-slate-600" />
                </span>
                <span className="text-[12.5px] leading-[1.5] text-slate-700">
                  {pt.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Credentials · single-use
            </div>
            <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.01em]">
              Введите данные HH
            </h2>
          </div>

          <div className="space-y-4">
            <Field label="Email или телефон HH">
              <input
                type="text"
                value={hhLogin}
                onChange={(e) => setHhLogin(e.target.value)}
                placeholder="user@example.com или +79161234567"
                className={inputCls}
                required
                disabled={loading || done}
                autoComplete="off"
              />
            </Field>

            <Field
              label="Пароль HH"
              hint="используется один раз · хранятся только cookies"
            >
              <div className="relative">
                <Lock
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="password"
                  value={hhPassword}
                  onChange={(e) => setHhPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls + ' pl-9'}
                  required
                  disabled={loading || done}
                  autoComplete="off"
                />
              </div>
            </Field>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-800">
              <XCircle size={14} className="mt-0.5 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {done && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-800">
              <CheckCircle2 size={14} className="mt-0.5 flex-none" />
              <span>HH-аккаунт подключён. Перенаправляем на матчи…</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <a
              href="/matches"
              className="btn-secondary h-10 px-4 text-[13px]"
            >
              Пропустить
            </a>
            <button
              type="submit"
              disabled={loading || done || !hhLogin || !hhPassword}
              className="btn-primary h-10 px-5 text-[13px]"
            >
              {loading ? (
                <>
                  <span className="pulse-dot" />
                  AI логинится (15–30с)…
                </>
              ) : (
                <>
                  <Shield size={14} />
                  Подключить HH
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer trust line */}
        <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
          <Shield size={11} />
          TLS 1.3 · AES-256 encrypted cookies · zero-knowledge password
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Subcomponents
   ------------------------------------------------------------ */

const SECURITY_POINTS = [
  {
    Icon: Lock,
    text: 'Пароль передаётся через HTTPS, используется один раз для логина и сразу удаляется. Мы храним только зашифрованные cookies.',
  },
  {
    Icon: Shield,
    text: 'Используйте отдельный «рабочий» HH-аккаунт, не основной.',
  },
  {
    Icon: Info,
    text: 'HH может прислать SMS — эта версия пока SMS не поддерживает. Используйте аккаунт без 2FA или попробуйте позже.',
  },
  {
    Icon: AlertTriangle,
    text: 'Использование автоматизации нарушает ToS hh.ru. Аккаунт могут заблокировать. Принимаете риск на себя.',
  },
] as const

const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-500'

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
      <div className="mb-1.5 flex items-center gap-2">
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
