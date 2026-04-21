'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  User,
  FileText,
  Target,
  Filter,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Info,
  Wallet,
  TriangleAlert,
} from 'lucide-react'

/* ============================================================
   CareerPilot · Settings
   Client component — preserves useState, useEffect, /api/profile
   fetch + localStorage fallback, save/reset/update handlers.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

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
          setProfile({
            ...DEFAULT_PROFILE,
            full_name: data.candidate?.full_name || '',
          })
          setMode('server')
          return
        }

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
    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async () => {
    setError(null)
    if (mode === 'server') {
      const payload = {
        full_name: profile.full_name || null,
        cv_text: profile.cv,
        target_roles: profile.targetRoles
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        salary_min: profile.salaryMin ? Number(profile.salaryMin) : null,
        salary_max: profile.salaryMax ? Number(profile.salaryMax) : null,
        positive_keywords: profile.positiveKeywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        negative_keywords: profile.negativeKeywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
    <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[960px] px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>Аккаунт</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">Настройки</span>
        </div>

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Profile · CV · Keywords
            </div>
            <h1 className="mt-1 text-[36px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
              Настройки профиля
            </h1>
            <p className="mt-3 max-w-[540px] text-[14px] leading-[1.55] text-slate-500">
              Вставьте ваше CV и параметры поиска — AI-советник будет использовать
              эти данные для персональных рекомендаций.
            </p>
          </div>
          {mode !== 'loading' && (
            <ModeBadge mode={mode} />
          )}
        </header>

        {/* Content */}
        {mode === 'loading' ? (
          <div className="card p-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200">
              <span className="pulse-dot" />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              loading profile…
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name (server mode only) */}
            {mode === 'server' && (
              <SectionCard
                label="Identity"
                title="Ваше имя"
                Icon={User}
                tone="#2563eb"
              >
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                  placeholder="Иван Иванов"
                  className={inputCls}
                />
              </SectionCard>
            )}

            {/* CV */}
            <SectionCard
              label="RAG context"
              title="Ваше CV"
              hint="markdown или обычный текст · AI использует это для советов"
              Icon={FileText}
              tone="#7c3aed"
            >
              <textarea
                value={profile.cv}
                onChange={(e) => update('cv', e.target.value)}
                rows={12}
                placeholder={`# Иван Иванов
## Опыт
- 2020–2026: Senior Data Scientist в Компании X
  • Построил ML-модель скоринга, снижение дефолтов на 15%
…`}
                className="w-full resize-y rounded-md border border-slate-200 bg-slate-50/40 p-3 font-mono text-[12.5px] leading-[1.55] text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100"
              />
              <div className="mt-2 font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
                chars: {profile.cv.length}
              </div>
            </SectionCard>

            {/* Target roles + salary */}
            <SectionCard
              label="Target"
              title="Целевые роли и зарплата"
              Icon={Target}
              tone="#047857"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Целевые роли"
                  hint="через запятую"
                >
                  <input
                    type="text"
                    value={profile.targetRoles}
                    onChange={(e) => update('targetRoles', e.target.value)}
                    placeholder="Senior DS, ML Engineer, AI PM"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="От, ₽">
                    <input
                      type="number"
                      value={profile.salaryMin}
                      onChange={(e) => update('salaryMin', e.target.value)}
                      placeholder="300 000"
                      className={inputCls + ' tabular-nums'}
                    />
                  </Field>
                  <Field label="До, ₽">
                    <input
                      type="number"
                      value={profile.salaryMax}
                      onChange={(e) => update('salaryMax', e.target.value)}
                      placeholder="800 000"
                      className={inputCls + ' tabular-nums'}
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            {/* Keywords */}
            <SectionCard
              label="Filtering"
              title="Ключевые слова"
              hint="AI-советник отсеивает вакансии по negative, ищет по positive"
              Icon={Filter}
              tone="#ea580c"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Positive"
                  hint="что ищем · через запятую"
                >
                  <textarea
                    value={profile.positiveKeywords}
                    onChange={(e) => update('positiveKeywords', e.target.value)}
                    rows={4}
                    placeholder="AI, ML, LLM, blockchain, DeFi, fintech, Head of"
                    className={inputCls + ' resize-y'}
                  />
                </Field>
                <Field
                  label="Negative"
                  hint="что отсеиваем"
                >
                  <textarea
                    value={profile.negativeKeywords}
                    onChange={(e) => update('negativeKeywords', e.target.value)}
                    rows={4}
                    placeholder="стажёр, junior, 1С, SAP"
                    className={inputCls + ' resize-y'}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Actions */}
            <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-md border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                {saved && (
                  <span className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 size={11} />
                    saved
                  </span>
                )}
                {error && (
                  <span className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] text-red-700">
                    <XCircle size={12} />
                    {error}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="btn-secondary h-9 px-4 text-[12.5px]"
                >
                  <RotateCcw size={13} />
                  Сбросить
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary h-9 px-4 text-[12.5px]"
                >
                  <Save size={13} />
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Subcomponents
   ------------------------------------------------------------ */

const inputCls =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100'

function SectionCard({
  label,
  title,
  hint,
  Icon,
  tone,
  children,
}: {
  label: string
  title: string
  hint?: string
  Icon: any
  tone: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md"
          style={{ background: `${tone}15`, color: tone }}
        >
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="mt-0.5 text-[15px] font-semibold tracking-[-0.005em] text-slate-900">
            {title}
          </div>
          {hint && (
            <div className="mt-0.5 text-[12px] text-slate-500">{hint}</div>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

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

function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === 'server') {
    return (
      <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-700">
        <CheckCircle2 size={12} />
        server · synced
      </span>
    )
  }
  return (
    <Link
      href="/signup"
      className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-amber-800 hover:border-amber-300"
      title="Данные сохранятся только в этом браузере"
    >
      <TriangleAlert size={12} />
      local · localStorage
    </Link>
  )
}
