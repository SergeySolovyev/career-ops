'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConnectHHPage() {
  const router = useRouter()
  const [hhLogin, setHhLogin] = useState('')
  const [hhPassword, setHhPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [existing, setExisting] = useState<{ hh_email?: string | null; status?: string } | null>(null)

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
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Подключить HH-аккаунт</h1>
      <p className="mt-2 text-muted-foreground">
        Чтобы CareerPilot мог сканировать вакансии и отправлять отклики от вашего имени,
        нужно один раз войти в hh.ru через наш безопасный бэкенд.
      </p>

      {existing && (
        <div className="mt-6 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-900">
          ✓ HH-аккаунт уже подключён{existing.hh_email ? ` (${existing.hh_email})` : ''}.{' '}
          Можете обновить сессию ниже, если HH разлогинил.
        </div>
      )}

      <div className="mt-6 rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-xs text-yellow-900 leading-relaxed">
        <div className="font-semibold">⚠️ Важно про безопасность</div>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Пароль передаётся через HTTPS, используется один раз для логина и сразу удаляется. Мы храним только зашифрованные cookies.</li>
          <li>Используйте отдельный «рабочий» HH-аккаунт, не основной.</li>
          <li>HH может прислать SMS — эта версия пока SMS не поддерживает. Тогда используйте аккаунт без 2FA или попробуйте позже.</li>
          <li>Использование автоматизации нарушает ToS hh.ru. Аккаунт могут заблокировать. Принимаете риск на себя.</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold">Email или телефон HH</span>
          <input
            type="text"
            value={hhLogin}
            onChange={(e) => setHhLogin(e.target.value)}
            placeholder="user@example.com или +79161234567"
            className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            disabled={loading || done}
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold">Пароль HH</span>
          <input
            type="password"
            value={hhPassword}
            onChange={(e) => setHhPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            required
            disabled={loading || done}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Используется один раз. Не сохраняется. Хранятся только cookies сессии в зашифрованном виде.
          </p>
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {done && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            ✓ HH-аккаунт подключён! Перенаправляем на матчи…
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || done || !hhLogin || !hhPassword}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '🤖 AI логинится в HH (15–30с)…' : '🔐 Подключить HH'}
          </button>
          <a
            href="/matches"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Пропустить
          </a>
        </div>
      </form>
    </div>
  )
}
