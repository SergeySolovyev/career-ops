'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'careerpilot:user-profile'

interface UserProfile {
  full_name: string
  cv: string
  targetRoles: string
  salaryMin: string
  salaryMax: string
  positiveKeywords: string
  negativeKeywords: string
  customVacanciesJSON: string
}

const DEFAULT_PROFILE: UserProfile = {
  full_name: '',
  cv: '',
  targetRoles: '',
  salaryMin: '',
  salaryMax: '',
  positiveKeywords: '',
  negativeKeywords: '',
  customVacanciesJSON: '',
}

type Mode = 'loading' | 'server' | 'local'

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [saved, setSaved] = useState(false)
  const [mode, setMode] = useState<Mode>('loading')
  const [error, setError] = useState<string | null>(null)

  // Load: try server first, fall back to localStorage
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' })
        if (!res.ok) throw new Error('no server profile')
        const data = await res.json()
        if (cancelled) return

        if (data._source === 'user' && !data._empty) {
          setProfile({
            full_name: data.candidate?.full_name || '',
            cv: data.cv_text || '',
            targetRoles: (data.target?.roles || []).join(', '),
            salaryMin: data.target?.salary_target_min?.toString() || '',
            salaryMax: data.target?.salary_target_max?.toString() || '',
            positiveKeywords: (data.positive_keywords || []).join(', '),
            negativeKeywords: (data.negative_keywords || []).join(', '),
            customVacanciesJSON: '',
          })
          setMode('server')
          return
        }

        if (data._source === 'user' && data._empty) {
          // Authenticated but empty — start with name from auth
          setProfile({
            ...DEFAULT_PROFILE,
            full_name: data.candidate?.full_name || '',
          })
          setMode('server')
          return
        }

        // Demo fallback (anonymous) — use localStorage
        throw new Error('anon')
      } catch {
        if (cancelled) return
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          try {
            setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(stored) })
          } catch {}
        }
        setMode('local')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    setError(null)
    if (mode === 'server') {
      const payload = {
        full_name: profile.full_name || null,
        cv_text: profile.cv,
        target_roles: profile.targetRoles.split(',').map(s => s.trim()).filter(Boolean),
        salary_min: profile.salaryMin ? Number(profile.salaryMin) : null,
        salary_max: profile.salaryMax ? Number(profile.salaryMax) : null,
        positive_keywords: profile.positiveKeywords.split(',').map(s => s.trim()).filter(Boolean),
        negative_keywords: profile.negativeKeywords.split(',').map(s => s.trim()).filter(Boolean),
      }
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `HTTP ${res.status}`)
        return
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (!confirm('Сбросить все настройки?')) return
    if (mode === 'local') localStorage.removeItem(STORAGE_KEY)
    setProfile(DEFAULT_PROFILE)
  }

  const update = (field: keyof UserProfile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }))
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Настройки профиля</h1>
      <p className="mt-1 text-muted-foreground">
        Вставьте ваше CV и параметры поиска — AI-советник будет использовать эти данные.
      </p>

      {mode === 'local' && (
        <div className="mt-4 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          Вы не залогинены. Данные сохранятся только в этом браузере (localStorage).
          {' '}Для сохранения на сервере <a href="/signup" className="font-semibold underline">зарегистрируйтесь</a>.
        </div>
      )}
      {mode === 'server' && (
        <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
          ✓ Залогинены. Профиль сохраняется на сервере и используется AI-советником в чате.
        </div>
      )}

      <div className="mt-8 space-y-6">
        {mode === 'server' && (
          <section className="rounded-xl border border-border p-6">
            <label className="block">
              <span className="text-sm font-semibold">Ваше имя</span>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                placeholder="Иван Иванов"
                className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </section>
        )}

        {/* CV */}
        <section className="rounded-xl border border-border p-6">
          <label className="block">
            <span className="text-sm font-semibold">Ваше CV (markdown или обычный текст)</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Опыт работы, ключевые достижения, навыки. AI будет использовать это для RAG-советов.
            </p>
            <textarea
              value={profile.cv}
              onChange={(e) => update('cv', e.target.value)}
              rows={12}
              placeholder="# Иван Иванов&#10;## Опыт&#10;- 2020–2026: Senior Data Scientist в Компании X&#10;  • Построил ML-модель скоринга, снижение дефолтов на 15%&#10;  ..."
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </section>

        {/* Target roles + salary */}
        <section className="rounded-xl border border-border p-6 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">Целевые роли</span>
            <p className="mt-1 text-xs text-muted-foreground">Через запятую</p>
            <input
              type="text"
              value={profile.targetRoles}
              onChange={(e) => update('targetRoles', e.target.value)}
              placeholder="Senior Data Scientist, ML Engineer, AI Product Manager"
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold">Зарплата от, ₽</span>
              <input
                type="number"
                value={profile.salaryMin}
                onChange={(e) => update('salaryMin', e.target.value)}
                placeholder="300000"
                className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">до, ₽</span>
              <input
                type="number"
                value={profile.salaryMax}
                onChange={(e) => update('salaryMax', e.target.value)}
                placeholder="800000"
                className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>
        </section>

        {/* Keywords */}
        <section className="rounded-xl border border-border p-6 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">Positive keywords</span>
            <p className="mt-1 text-xs text-muted-foreground">То что ищем, через запятую</p>
            <textarea
              value={profile.positiveKeywords}
              onChange={(e) => update('positiveKeywords', e.target.value)}
              rows={4}
              placeholder="AI, ML, LLM, blockchain, DeFi, fintech, директор, Head of"
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Negative keywords</span>
            <p className="mt-1 text-xs text-muted-foreground">Чтобы отсеивать</p>
            <textarea
              value={profile.negativeKeywords}
              onChange={(e) => update('negativeKeywords', e.target.value)}
              rows={4}
              placeholder="стажёр, junior, 1С, SAP"
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={mode === 'loading'}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Сохранить
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary"
          >
            Сбросить
          </button>
          {saved && (
            <span className="text-sm text-green-600 animate-pulse">✓ Сохранено</span>
          )}
          {error && (
            <span className="text-sm text-destructive">Ошибка: {error}</span>
          )}
        </div>
      </div>
    </div>
  )
}
