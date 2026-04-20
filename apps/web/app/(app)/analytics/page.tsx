import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BarChart3,
  Search,
  Filter,
  Bot,
  Star,
  Mail,
  Briefcase,
  Award,
  Settings,
  ExternalLink,
  TrendingUp,
} from 'lucide-react'

/* ============================================================
   CareerPilot · Analytics
   Server component — preserves /api/stats, /api/profile.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

async function getStats() {
  const h = await headers()
  const host = h.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const cookie = h.get('cookie') || ''
  try {
    const res = await fetch(`${protocol}://${host}/api/stats`, {
      cache: 'no-store',
      headers: { cookie },
    })
    return res.json()
  } catch {
    return null
  }
}

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

const FUNNEL_STAGES = [
  { key: 'found', label: 'Найдено вакансий', color: '#2563eb', Icon: Search },
  { key: 'preScreened', label: 'Прошли pre-screen', color: '#4f46e5', Icon: Filter },
  { key: 'aiEvaluated', label: 'Оценены AI', color: '#7c3aed', Icon: Bot },
  { key: 'recommended', label: 'Рекомендовано', color: '#047857', Icon: Star },
  { key: 'applied', label: 'Отклик отправлен', color: '#ea580c', Icon: Mail },
  { key: 'interviews', label: 'Интервью', color: '#dc2626', Icon: Briefcase },
  { key: 'offers', label: 'Офферы', color: '#ca8a04', Icon: Award },
] as const

export default async function AnalyticsPage() {
  const [data, profile] = await Promise.all([getStats(), getProfile()])
  const isUserProfile = profile?._source === 'user'

  // Auth'd users without CV → onboarding
  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  if (!data || !data.funnel) {
    return (
      <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
        <div className="mx-auto max-w-[1200px] px-6 py-10">
          <PageHeader />
          <div className="mt-8 rounded-md border border-slate-200 bg-slate-50 p-6 text-[13px] text-slate-500">
            Данные недоступны
          </div>
        </div>
      </div>
    )
  }

  // Empty funnel for auth'd users — show friendly empty state
  if (isUserProfile && (data.funnel.found || 0) === 0) {
    return (
      <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
        <div className="mx-auto max-w-[1200px] px-6 py-10">
          <PageHeader />
          <div className="card mt-8 flex flex-col items-center py-16 px-6 text-center">
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
              <BarChart3 size={22} />
              <span
                className="absolute -inset-2 -z-10 rounded-2xl opacity-50 blur-xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)',
                }}
              />
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
              Funnel · pending
            </div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">
              Пока нет данных
            </h2>
            <p className="mt-2 max-w-[400px] text-[13px] text-slate-500">
              Воронка появится после первых сканов и AI-оценок вакансий. Сканер
              запускается раз в 4 часа.
            </p>
            <Link href="/settings" className="btn-secondary mt-6 h-10 px-5 text-[13px]">
              <Settings size={14} />
              Настроить ключевые слова
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { funnel, stats, topVacancies } = data
  const maxCount = funnel.found || 1

  // Calc conversions between consecutive stages
  const stagesWithConv = FUNNEL_STAGES.map((stage, i) => {
    const count = funnel[stage.key] || 0
    const prevKey = i > 0 ? FUNNEL_STAGES[i - 1].key : null
    const prevCount = prevKey ? funnel[prevKey] || 0 : count
    const widthPct = Math.max((count / maxCount) * 100, 2)
    const fromPrev =
      i === 0 ? 100 : prevCount > 0 ? (count / prevCount) * 100 : 0
    return { ...stage, count, widthPct, fromPrev }
  })

  return (
    <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <PageHeader />

        {/* Key metrics */}
        <section className="mt-8 grid gap-3 sm:grid-cols-4">
          <MetricTile
            label="Обработано"
            value={stats.totalEvaluated}
            tone="#2563eb"
            Icon={Bot}
          />
          <MetricTile
            label="Средний скор"
            value={stats.avgScore}
            tone="#7c3aed"
            Icon={BarChart3}
            decimals
          />
          <MetricTile
            label="Apply rate"
            value={`${stats.applyRate}%`}
            tone="#047857"
            Icon={TrendingUp}
          />
          <MetricTile
            label="Макс скор"
            value={stats.topScore}
            tone="#ea580c"
            Icon={Star}
            decimals
          />
        </section>

        {/* Funnel */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Funnel · found → offer
              </div>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
                Воронка конверсии
              </h2>
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-400">
              7 stages · continuous
            </span>
          </div>

          <div className="card p-5">
            <div className="space-y-3">
              {stagesWithConv.map((s) => (
                <FunnelRow
                  key={s.key}
                  Icon={s.Icon}
                  label={s.label}
                  count={s.count}
                  color={s.color}
                  widthPct={s.widthPct}
                  fromPrev={s.fromPrev}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Top vacancies */}
        {topVacancies && topVacancies.length > 0 && (
          <section className="mt-10">
            <div className="mb-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Top picks
              </div>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
                Топ-{topVacancies.length} вакансий
              </h2>
            </div>
            <div className="card divide-y divide-slate-100">
              {topVacancies.map((v: any, i: number) => {
                const title =
                  v.report
                    ?.replace('.md', '')
                    .replace(/^\d+-/, '')
                    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
                    .replace(/-/g, ' ') || v.url
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60"
                  >
                    <span className="font-mono text-[10.5px] text-slate-400 tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="inline-flex h-7 items-center justify-center rounded-md border px-2 font-mono text-[11.5px] font-semibold tabular-nums"
                      style={{
                        background: '#ecfdf5',
                        color: '#047857',
                        borderColor: '#a7f3d0',
                      }}
                    >
                      {v.score}/5
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                      {title}
                    </span>
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-blue-600 hover:underline"
                    >
                      hh.ru
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 text-[12px] text-slate-500">
          <span>Воронка обновляется после каждого запуска сканера</span>
          <span className="inline-flex items-center gap-2 font-mono uppercase tracking-wider">
            <span className="pulse-dot" /> autopilot · every 4h
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Subcomponents
   ------------------------------------------------------------ */

function PageHeader() {
  return (
    <>
      <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
        <Link href="/dashboard" className="hover:text-slate-900">
          Workspace
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900">Analytics</span>
      </div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
            Аналитика воронки
          </h1>
          <p className="mt-3 max-w-[540px] text-[15px] leading-[1.55] text-slate-500">
            Конверсия от обнаружения вакансии до оффера. Каждый этап — отдельная
            метрика с пошаговой конверсией.
          </p>
        </div>
      </header>
    </>
  )
}

function MetricTile({
  label,
  value,
  tone,
  Icon,
  decimals,
}: {
  label: string
  value: any
  tone: string
  Icon: any
  decimals?: boolean
}) {
  const display =
    typeof value === 'number' && decimals ? value.toFixed(1) : String(value)
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: `${tone}15`, color: tone }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          metric
        </span>
      </div>
      <div
        className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
        style={{ color: tone }}
      >
        {display}
      </div>
      <div className="mt-1.5 text-[12px] text-slate-500">{label}</div>
    </div>
  )
}

function FunnelRow({
  Icon,
  label,
  count,
  color,
  widthPct,
  fromPrev,
}: {
  Icon: any
  label: string
  count: number
  color: string
  widthPct: number
  fromPrev: number
}) {
  return (
    <div className="flex items-center gap-4">
      {/* Label col */}
      <div className="flex w-[200px] flex-none items-center gap-2.5">
        <span
          className="flex h-7 w-7 flex-none items-center justify-center rounded-md"
          style={{ background: `${color}15`, color }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-medium text-slate-900">
            {label}
          </div>
        </div>
      </div>

      {/* Bar */}
      <div className="flex-1">
        <div className="relative h-8 w-full rounded-md bg-slate-50">
          <div
            className="flex h-8 items-center rounded-md px-3 text-[12px] font-medium text-white transition-all duration-500"
            style={{
              width: `${widthPct}%`,
              background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            }}
          >
            <span className="tabular-nums">{count}</span>
          </div>
        </div>
      </div>

      {/* Conversion col */}
      <div className="flex w-[120px] flex-none items-center justify-end gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          from prev
        </span>
        <span className="min-w-[44px] text-right font-mono text-[12.5px] font-medium tabular-nums text-slate-700">
          {fromPrev.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
