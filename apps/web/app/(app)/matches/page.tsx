import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Search,
  Filter,
  Radar,
  ExternalLink,
  Send,
  Check,
  AlertTriangle,
  ChevronDown,
  Sparkles,
  MapPin,
  Wallet,
  ArrowUpRight,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import ScanButton from './scan-button'
import ApplyButton from './apply-button'

/* ============================================================
   CareerPilot · Matches page
   Server component — preserves /api/profile fetch + user_evaluations schema.
   Visual layer refreshed via Claude Design (Linear/Notion/Raycast aesthetic).
   ============================================================ */

type Verdict = 'apply' | 'maybe' | 'skip' | string

type Evaluation = {
  url: string
  title: string
  company: string
  location?: string | null
  salary_from?: number | null
  salary_to?: number | null
  salary_currency?: string | null
  ai_score?: number | null
  ai_verdict?: Verdict | null
  ai_summary?: string | null
  ai_strengths?: string[] | null
  evaluated_at?: string | null
}

/* ------------------------------------------------------------
   Server-side data loaders — unchanged business logic
   ------------------------------------------------------------ */

async function getProfile() {
  const h = await headers()
  const host = h.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const cookie = h.get('cookie') || ''
  try {
    const res = await fetch(`${protocol}://${host}/api/profile`, {
      cache: 'no-store',
      headers: { cookie },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getEvaluations(): Promise<Evaluation[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('user_evaluations')
      .select('url,title,company,salary_from,salary_to,salary_currency,location,ai_score,ai_verdict,ai_summary,ai_strengths,evaluated_at')
      .eq('user_id', user.id)
      .order('ai_score', { ascending: false })
      .limit(20)
    return (data as Evaluation[]) || []
  } catch {
    return []
  }
}

async function getHHSession(): Promise<{ connected: boolean; hh_email?: string | null }> {
  if (!isSupabaseConfigured()) return { connected: false }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { connected: false }
    const { data } = await supabase
      .from('hh_sessions')
      .select('status, hh_email')
      .eq('user_id', user.id)
      .maybeSingle()
    return {
      connected: data?.status === 'active',
      hh_email: data?.hh_email,
    }
  } catch {
    return { connected: false }
  }
}

/* ------------------------------------------------------------
   Presentational helpers
   ------------------------------------------------------------ */

function scoreTone(score: number) {
  if (score >= 4) return { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0', dot: '#10b981', label: 'Strong' }
  if (score >= 3) return { bg: '#fffbeb', fg: '#92400e', border: '#fde68a', dot: '#f59e0b', label: 'Medium' }
  return { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0', dot: '#94a3b8', label: 'Weak' }
}

function verdictBadge(v: Verdict | null | undefined) {
  if (v === 'apply') return { label: 'Откликнуться', fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981' }
  if (v === 'maybe') return { label: 'На проверке', fg: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' }
  return { label: 'Пропустить', fg: '#64748b', bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8' }
}

function fmtSalary(min?: number | null, max?: number | null, cur?: string | null) {
  const c = cur === 'RUR' || cur === 'RUB' || !cur ? '₽' : cur
  if (!min && !max) return 'з/п не указана'
  const f = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : `${Math.round(n / 1000)}k`
  if (min && max) return `${c} ${f(min)}–${f(max)}`
  if (min) return `${c} от ${f(min)}`
  return `${c} до ${f(max!)}`
}

/* ------------------------------------------------------------
   Page
   ------------------------------------------------------------ */

export default async function MatchesPage() {
  const profile = await getProfile()
  const isUserProfile = profile?._source === 'user'

  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  const evaluations = isUserProfile ? await getEvaluations() : []
  const hh = isUserProfile ? await getHHSession() : { connected: false }

  const stats = {
    total: evaluations.length,
    strong: evaluations.filter((e) => (e.ai_score ?? 0) >= 4).length,
    medium: evaluations.filter((e) => (e.ai_score ?? 0) >= 3 && (e.ai_score ?? 0) < 4).length,
    weak: evaluations.filter((e) => (e.ai_score ?? 0) < 3).length,
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        {/* -------------------- Breadcrumb -------------------- */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-900">
            Workspace
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">Matches</span>
        </div>

        {/* -------------------- Header -------------------- */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
              Новые матчи
            </h1>
            <p className="mt-3 max-w-[560px] text-[15px] leading-[1.55] text-slate-500">
              Вакансии, отобранные AI по вашему CV и целям. Оценка по 10 критериям:
              fit, рост, компенсация, культура, stack и ещё 5.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isUserProfile && <ScanButton />}
            <button className="btn-secondary h-10 px-4 text-[13px]">
              <Filter size={14} />
              Фильтры · 3
            </button>
          </div>
        </header>

        {/* -------------------- Anon demo banner -------------------- */}
        {!isUserProfile && (
          <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-[13px] text-blue-900">
            <span className="font-semibold">Demo-режим.</span>{' '}
            Это пример из публичного кабинета.{' '}
            <Link href="/signup" className="font-semibold underline">
              Зарегистрируйтесь
            </Link>
            , чтобы видеть собственные AI-матчи.
          </div>
        )}

        {/* -------------------- Summary strip -------------------- */}
        {isUserProfile && evaluations.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryTile label="Всего" value={stats.total.toString()} tone="#0f172a" badge="20 · лимит" />
            <SummaryTile label="Score ≥ 4" value={stats.strong.toString()} tone="#2563eb" badge="apply" />
            <SummaryTile label="Score 3–4" value={stats.medium.toString()} tone="#f59e0b" badge="maybe" />
            <SummaryTile label="Score < 3" value={stats.weak.toString()} tone="#94a3b8" badge="skip" />
          </div>
        )}

        {/* -------------------- HH banner -------------------- */}
        {isUserProfile && !hh.connected && <HHBanner />}

        {/* -------------------- HH connected badge -------------------- */}
        {isUserProfile && hh.connected && (
          <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12.5px] text-emerald-800">
            ✓ HH-аккаунт подключён{hh.hh_email ? ` (${hh.hh_email})` : ''}
          </div>
        )}

        {/* -------------------- Filter bar -------------------- */}
        {isUserProfile && evaluations.length > 0 && <FilterBar />}

        {/* -------------------- Body -------------------- */}
        {!isUserProfile ? (
          <DemoCard />
        ) : evaluations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 space-y-3">
            {evaluations.map((ev) => (
              <MatchCard key={ev.url} ev={ev} />
            ))}
          </div>
        )}

        {/* -------------------- Footer hint -------------------- */}
        {isUserProfile && evaluations.length > 0 && (
          <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 text-[12.5px] text-slate-500">
            <span>Показано {evaluations.length} из 20 · Обновлено только что</span>
            <span className="inline-flex items-center gap-2 font-mono">
              <span className="pulse-dot" /> autopilot · live
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   SummaryTile
   ------------------------------------------------------------ */

function SummaryTile({
  label,
  value,
  tone,
  badge,
}: {
  label: string
  value: string
  tone: string
  badge: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <span className="font-mono text-[10px] text-slate-500">{badge}</span>
      </div>
      <div
        className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em]"
        style={{ color: tone }}
      >
        {value}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   HHBanner
   ------------------------------------------------------------ */

function HHBanner() {
  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
      style={{ background: '#fffbeb', borderColor: '#fde68a' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md"
          style={{ background: '#fef3c7', color: '#92400e' }}
        >
          <AlertTriangle size={15} />
        </span>
        <div>
          <div className="text-[13.5px] font-medium" style={{ color: '#92400e' }}>
            HH-аккаунт не подключён
          </div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: '#a16207' }}>
            Подключите hh.ru, чтобы включить авто-отклик и видеть полные данные по вакансиям.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/connect-hh"
          className="btn-primary h-9 text-[12.5px]"
          style={{ background: '#92400e' }}
        >
          Подключить HH
          <ArrowUpRight size={14} />
        </Link>
        <Link
          href="/connect-hh"
          className="text-[12.5px] underline-offset-2 hover:underline"
          style={{ color: '#92400e' }}
        >
          Позже
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   FilterBar — visual only (client-side filtering not wired yet)
   ------------------------------------------------------------ */

function FilterBar() {
  return (
    <div className="card flex flex-wrap items-center gap-2 p-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} color="#64748b" />
        <input
          className="h-9 w-full rounded-md border border-transparent bg-transparent pl-9 pr-3 text-[13px] outline-none focus:border-slate-200 focus:bg-white"
          placeholder="Поиск по роли, компании, стеку…"
        />
      </div>

      <FilterGroup
        label="Score"
        options={[
          { k: 'all', v: 'Все', active: true },
          { k: 'strong', v: '≥ 4' },
          { k: 'medium', v: '3–4' },
          { k: 'weak', v: '< 3' },
        ]}
      />

      <div className="h-5 w-px bg-slate-200" />

      <FilterGroup
        label="Verdict"
        options={[
          { k: 'apply', v: 'apply', dot: '#10b981' },
          { k: 'maybe', v: 'maybe', dot: '#f59e0b' },
          { k: 'skip', v: 'skip', dot: '#94a3b8' },
        ]}
      />

      <div className="h-5 w-px bg-slate-200" />

      <button className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] text-slate-500 hover:bg-slate-50">
        <Wallet size={13} />
        Salary
        <ChevronDown size={13} />
      </button>

      <button className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] text-slate-500 hover:bg-slate-50">
        <MapPin size={13} />
        Город
        <ChevronDown size={13} />
      </button>

      <div className="ml-auto font-mono text-[11px] text-slate-500">sort · score ↓</div>
    </div>
  )
}

function FilterGroup({
  label,
  options,
}: {
  label: string
  options: { k: string; v: string; active?: boolean; dot?: string }[]
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      {options.map((o) => (
        <button
          key={o.k}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition"
          style={{
            background: o.active ? '#0f172a' : 'transparent',
            color: o.active ? '#fff' : '#64748b',
          }}
        >
          {o.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.dot }} />}
          {o.v}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------
   MatchCard
   ------------------------------------------------------------ */

function MatchCard({ ev }: { ev: Evaluation }) {
  const score = ev.ai_score ?? 0
  const tone = scoreTone(score)
  const badge = verdictBadge(ev.ai_verdict)

  // 10-dim match placeholder — derived from score (real dims would come from AI eval JSON)
  const dims = Array.from({ length: 10 }, (_, i) =>
    Math.min(1, Math.max(0, (score / 5) * (0.7 + ((i * 37) % 50) / 100))),
  )
  const strengths = ev.ai_strengths && ev.ai_strengths.length > 0 ? ev.ai_strengths.slice(0, 3) : []
  const summary = ev.ai_summary ?? ''

  return (
    <article className="card tile relative overflow-hidden p-5">
      <div className="grid grid-cols-12 gap-5">
        {/* -------- Score slot -------- */}
        <div className="col-span-12 md:col-span-2">
          <div
            className="relative flex h-[104px] w-full flex-col items-center justify-center rounded-lg border"
            style={{ background: tone.bg, borderColor: tone.border }}
          >
            <div
              className="font-semibold leading-none tracking-[-0.03em]"
              style={{ fontSize: 40, color: tone.fg }}
            >
              {score.toFixed(1)}
            </div>
            <div className="mt-1 font-mono text-[10px]" style={{ color: tone.fg }}>
              / 5.0 · {tone.label}
            </div>
            <div
              className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-lg"
              style={{ background: tone.dot, opacity: 0.6 }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
            <span>10-dim</span>
            <span className="text-slate-900">
              {((dims.reduce((a, b) => a + b, 0) / dims.length) * 5).toFixed(1)}
            </span>
          </div>
        </div>

        {/* -------- Main column -------- */}
        <div className="col-span-12 md:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[18px] font-semibold leading-tight tracking-tight">{ev.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-500">
                <span className="font-medium text-slate-900">{ev.company}</span>
                {ev.location && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {ev.location}
                    </span>
                  </>
                )}
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Wallet size={12} />
                  {fmtSalary(ev.salary_from, ev.salary_to, ev.salary_currency)}
                </span>
              </div>
            </div>
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium"
              style={{ color: badge.fg, background: badge.bg, borderColor: badge.border }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.dot }} />
              {badge.label}
            </span>
          </div>

          {/* AI summary — quote style */}
          {summary && (
            <div
              className="mt-4 flex gap-3 rounded-md border-l-2 bg-slate-50 p-3"
              style={{ borderColor: '#2563eb' }}
            >
              <Sparkles size={14} className="mt-[2px] flex-none" color="#2563eb" />
              <p className="text-[13px] leading-[1.55] text-slate-700">{summary}</p>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-1.5 md:grid-cols-3">
              {strengths.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[12.5px]"
                >
                  <span
                    className="mt-[1px] flex h-4 w-4 flex-none items-center justify-center rounded-full"
                    style={{ background: '#ecfdf5', color: '#047857' }}
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span className="leading-[1.4]">{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* -------- Right column: match bars + actions -------- */}
        <div className="col-span-12 flex flex-col justify-between gap-4 md:col-span-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <span>10-dim match</span>
              <span className="text-slate-400">fit · рост · $$$</span>
            </div>
            <div className="flex h-[52px] items-end gap-[3px]">
              {dims.map((d, i) => {
                const h = Math.max(6, d * 52)
                const active = d >= 0.5
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: h,
                      background: active ? '#2563eb' : '#cbd5e1',
                      opacity: active ? 0.85 : 1,
                    }}
                  />
                )
              })}
            </div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className="h-0.5 flex-1 rounded-full"
                  style={{ background: dims[i] >= 0.5 ? '#2563eb' : '#e2e8f0' }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <ApplyButton vacancyUrl={ev.url} score={score} />
            {ev.url ? (
              <a
                href={ev.url}
                target="_blank"
                rel="noopener"
                className="btn-secondary h-9 w-full justify-center text-[12.5px]"
              >
                <ExternalLink size={13} />
                Открыть в HH
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------
   EmptyState
   ------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="card lift relative mt-6 overflow-hidden">
      <div className="grid grid-cols-12 gap-0">
        <div className="col-span-12 p-10 md:col-span-7 md:p-14">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#2563eb]">
            <Radar size={12} />
            Сканирование не запускалось
          </div>
          <h2 className="mt-3 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Матчей пока нет
          </h2>
          <p className="mt-3 max-w-[440px] text-[14.5px] leading-[1.6] text-slate-500">
            Запустите сканирование — AI пройдёт по hh.ru, оценит новые вакансии
            по 10 критериям и покажет подходящие для вашего уровня роли. Скан
            занимает 30–60 секунд.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <ScanButton />
            <Link href="/settings" className="btn-secondary h-10 px-4 text-[13px]">
              <Send size={14} />
              Настроить ключевые слова
            </Link>
          </div>
          <div className="mt-8 grid max-w-[440px] grid-cols-3 gap-3">
            {[
              ['1 · scan', '—'],
              ['2 · score', '—'],
              ['3 · apply', '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md border border-slate-200 p-3">
                <div className="font-mono text-[10px] text-slate-500">{l}</div>
                <div className="mt-1 text-[18px] font-semibold tracking-tight">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Radar illustration */}
        <div className="relative col-span-12 bg-slate-50 md:col-span-5">
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 360 360" className="h-[340px] w-[340px]">
              <defs>
                <radialGradient id="empty-radar" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g transform="translate(180,180)">
                <circle r="160" fill="url(#empty-radar)" />
                <circle r="160" fill="none" stroke="#e2e8f0" />
                <circle r="110" fill="none" stroke="#e2e8f0" />
                <circle r="60" fill="none" stroke="#e2e8f0" />
                <line x1="-160" y1="0" x2="160" y2="0" stroke="#e2e8f0" />
                <line x1="0" y1="-160" x2="0" y2="160" stroke="#e2e8f0" />
                <path d="M 0 0 L 160 0 A 160 160 0 0 1 113 113 Z" fill="#2563eb" fillOpacity="0.1">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="6s"
                    repeatCount="indefinite"
                  />
                </path>
                <circle cx="-70" cy="-40" r="3" fill="#2563eb" />
                <circle cx="65" cy="-80" r="3" fill="#2563eb" />
                <circle cx="100" cy="50" r="3" fill="#2563eb" />
                <circle cx="-40" cy="100" r="3" fill="#2563eb" />
                <circle cx="-110" cy="30" r="3" fill="#2563eb" />
                <circle cx="30" cy="-30" r="4" fill="#0f172a" />
                <circle cx="0" cy="0" r="8" fill="#0f172a" />
                <circle cx="0" cy="0" r="14" fill="none" stroke="#0f172a" strokeOpacity="0.2" />
              </g>
            </svg>
          </div>
          <div className="relative px-6 pb-6 pt-[320px] text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              match engine · v4.2 · ready
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   DemoCard — shown to anonymous visitors
   ------------------------------------------------------------ */

function DemoCard() {
  return (
    <div className="mt-6 space-y-3">
      <article className="card tile relative overflow-hidden p-5">
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-2">
            <div
              className="relative flex h-[104px] w-full flex-col items-center justify-center rounded-lg border"
              style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}
            >
              <div
                className="font-semibold leading-none tracking-[-0.03em]"
                style={{ fontSize: 40, color: '#047857' }}
              >
                4.7
              </div>
              <div className="mt-1 font-mono text-[10px]" style={{ color: '#047857' }}>
                / 5.0 · Strong
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-semibold leading-tight tracking-tight">
                  Лидер направления по AI
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-500">
                  <span className="font-medium text-slate-900">Сбер · demo</span>
                  <span className="text-slate-300">·</span>
                  <span>Москва</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">₽ 400k–600k</span>
                </div>
              </div>
              <span
                className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium"
                style={{ color: '#047857', background: '#ecfdf5', borderColor: '#a7f3d0' }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10b981' }} />
                Откликнуться
              </span>
            </div>
            <div
              className="mt-4 flex gap-3 rounded-md border-l-2 bg-slate-50 p-3"
              style={{ borderColor: '#2563eb' }}
            >
              <Sparkles size={14} className="mt-[2px] flex-none" color="#2563eb" />
              <p className="text-[13px] leading-[1.55] text-slate-700">
                AI + банкинг = точный профиль. 20 лет финрынков и research papers — seniority
                match для позиции уровня Director.
              </p>
            </div>
            <div className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
              Это пример из demo-кабинета.{' '}
              <Link href="/signup" className="font-semibold underline">
                Зарегистрируйтесь
              </Link>
              , чтобы видеть собственные AI-матчи.
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
