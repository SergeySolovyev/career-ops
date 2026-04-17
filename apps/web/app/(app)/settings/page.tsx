'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'careerpilot:user-profile'

interface UserProfile {
  cv: string
  targetRoles: string
  salaryMin: string
  salaryMax: string
  positiveKeywords: string
  negativeKeywords: string
  customVacanciesJSON: string
}

const DEFAULT_PROFILE: UserProfile = {
  cv: '',
  targetRoles: '',
  salaryMin: '',
  salaryMax: '',
  positiveKeywords: '',
  negativeKeywords: '',
  customVacanciesJSON: '',
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(stored) })
      } catch {
        // ignore
      }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (confirm('Сбросить все настройки?')) {
      localStorage.removeItem(STORAGE_KEY)
      setProfile(DEFAULT_PROFILE)
    }
  }

  const update = (field: keyof UserProfile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }))
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Настройки профиля</h1>
      <p className="mt-1 text-muted-foreground">
        Вставьте ваше CV и параметры поиска — AI-советник будет использовать эти данные.
        Всё хранится локально в вашем браузере.
      </p>

      <div className="mt-8 space-y-6">
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

        {/* Custom vacancies */}
        <section className="rounded-xl border border-border p-6">
          <label className="block">
            <span className="text-sm font-semibold">Свои вакансии (опционально, JSON)</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Массив объектов {"{ url, title, company, score, status }"}. Показываются в Dashboard/Analytics вместо demo-данных.
            </p>
            <textarea
              value={profile.customVacanciesJSON}
              onChange={(e) => update('customVacanciesJSON', e.target.value)}
              rows={8}
              placeholder='[{"url":"https://hh.ru/vacancy/123","title":"Head of AI","company":"Банк","score":4.5,"status":"apply"}]'
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
        </div>

        <p className="text-xs text-muted-foreground">
          Данные хранятся в localStorage вашего браузера. Для серверного хранения подключите Supabase (см. DEPLOY.md).
        </p>
      </div>
    </div>
  )
}
