import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  Sparkles,
  MessageSquare,
  Search,
  Bot,
  Star,
  Mail,
  Briefcase,
  MapPin,
  Phone,
  GraduationCap,
  ArrowUpRight,
  TrendingUp,
  Target,
  Zap,
} from 'lucide-react'

/* ============================================================
   CareerPilot · Dashboard
   Server component — preserves /api/stats, /api/profile, loadJSON.
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

async function getUserProfile() {
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

function loadJSON(filename: string) {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', filename), 'utf-8'))
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const data = await getStats()
  const apiProfile = await getUserProfile()
  const isUserProfile = apiProfile?._source === 'user'
  const isEmptyUserProfile = isUserProfile && apiProfile?._empty

  // Auth'd users without CV → onboarding
  if (isEmptyUserProfile) {
    redirect('/onboarding')
  }

  const profile = isUserProfile ? apiProfile : loadJSON('profile.json')
  const evalLog = !isUserProfile
    ? loadJSON('auto-eval-log.json') || { evaluated: {} }
    : { evaluated: {} }

  const stats = data?.funnel
    ? {
        found: data.funnel.found,
        evaluated: data.funnel.aiEvaluated,
        recommended: data.funnel.recommended,
        applied: data.funnel.applied,
        interviews: data.funnel.interviews,
      }
    : { found: 0, evaluated: 0, recommended: 0, applied: 0, interviews: 0 }

  const recentEvals = Object.entries(evalLog.evaluated || {})
    .filter(([, v]) => (v as any).status === 'apply')
    .sort((a, b) => ((b[1] as any).score || 0) - ((a[1] as any).score || 0))
    .slice(0, 5) as [string, any][]

  const candidate = profile?.candidate
  const target = profile?.target
  const firstName = candidate?.first_name || 'пользователь'
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5) return 'Доброй ночи'
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  })()

  return (
    <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span className="text-slate-900">Workspace</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">Dashboard</span>
        </div>

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
              {greeting}, {firstName}
            </h1>
            <p className="mt-3 max-w-[560px] text-[15px] leading-[1.55] text-slate-500">
              {candidate?.current_role || 'Ваш AI-советник работает в фоне. Вот что нового.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/chat" className="btn-primary h-10 px-4 text-[13px]">
              <MessageSquare size={14} />
              Спросить AI
            </Link>
            <Link href="/matches" className="btn-secondary h-10 px-4 text-[13px]">
              <Star size={14} />
              Матчи
            </Link>
          </div>
        </header>

        {/* Demo banner */}
        {!isUserProfile && (
          <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-[13px] text-blue-900">
            <span className="font-semibold">Demo-режим.</span>{' '}
            Это публичный кабинет Сергея с реальными данными.{' '}
            <Link href="/signup" className="font-semibold underline">
              Зарегистрируйтесь
            </Link>{' '}
            — и загрузите своё CV.
          </div>
        )}

        {/* Profile summary */}
        {profile && (
          <section className="mb-8 grid gap-3 md:grid-cols-3">
            <ProfileTile
              label="Целевые роли"
              Icon={Target}
              tone="#2563eb"
            >
              <ul className="space-y-1 text-[13px] text-slate-700">
                {target?.roles?.slice(0, 3).map((r: string) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-blue-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </ProfileTile>

            <ProfileTile
              label="Вилка зарплаты"
              Icon={TrendingUp}
              tone="#047857"
            >
              <div className="text-[22px] font-semibold leading-none tracking-[-0.01em]">
                {target?.salary_target_min?.toLocaleString('ru-RU')}–
                {target?.salary_target_max?.toLocaleString('ru-RU')} ₽
              </div>
              <div className="mt-2 font-mono text-[11px] text-slate-500">
                {target?.international_range} · international
              </div>
            </ProfileTile>

            <ProfileTile
              label="Контакты"
              Icon={Mail}
              tone="#7c3aed"
            >
              <div className="space-y-1.5 text-[12.5px] text-slate-700">
                {candidate?.location && (
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="flex-none text-slate-400" />
                    <span>{candidate.location}</span>
                  </div>
                )}
                {candidate?.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="flex-none text-slate-400" />
                    <span className="truncate">{candidate.email}</span>
                  </div>
                )}
                {candidate?.telegram && (
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="flex-none text-slate-400" />
                    <span>{candidate.telegram}</span>
                  </div>
                )}
              </div>
            </ProfileTile>
          </section>
        )}

        {/* Funnel */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Funnel
              </div>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
                Воронка поиска
              </h2>
            </div>
            {isUserProfile && (
              <span className="pill">
                <span className="pulse-dot" />
                старт — появится после первых откликов
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <FunnelTile label="Найдено" value={stats.found} Icon={Search} tone="#2563eb" />
            <FunnelTile label="Оценено AI" value={stats.evaluated} Icon={Bot} tone="#7c3aed" />
            <FunnelTile label="Рекомендовано" value={stats.recommended} Icon={Star} tone="#047857" />
            <FunnelTile label="Отклики" value={stats.applied} Icon={Mail} tone="#ea580c" />
            <FunnelTile label="Интервью" value={stats.interviews} Icon={Briefcase} tone="#dc2626" />
          </div>
        </section>

        {/* Two-column: matches + superpowers */}
        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Top matches */}
          <div>
            <div className="mb-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Picks
              </div>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
                Топ AI-матчей
              </h2>
            </div>
            <div className="space-y-2">
              {recentEvals.length === 0 && isUserProfile && (
                <div className="card p-8 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Target size={18} />
                  </div>
                  <p className="text-[13px] text-slate-500">
                    Пока нет оценённых вакансий.
                  </p>
                  <Link
                    href="/chat"
                    className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-blue-600 hover:underline"
                  >
                    <MessageSquare size={14} />
                    Спросите AI советника
                  </Link>
                </div>
              )}
              {recentEvals.length === 0 && !isUserProfile && (
                <p className="text-[13px] text-slate-500">Пока нет оценок.</p>
              )}
              {recentEvals.map(([url, v]) => {
                const slug = (v.report || '')
                  .replace('.md', '')
                  .replace(/^\d+-/, '')
                  .replace(/-\d{4}-\d{2}-\d{2}$/, '')
                  .replace(/-/g, ' ')
                const verdict =
                  v.status === 'apply'
                    ? { text: 'apply', fg: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
                    : v.status === 'maybe'
                    ? { text: 'maybe', fg: '#92400e', bg: '#fffbeb', border: '#fde68a' }
                    : { text: 'skip', fg: '#64748b', bg: '#f8fafc', border: '#e2e8f0' }
                const strong = v.score >= 4
                return (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener"
                    className="tile flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 hover:bg-slate-50"
                  >
                    <span
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-md text-[13px] font-semibold tabular-nums"
                      style={{
                        background: strong ? '#ecfdf5' : '#f1f5f9',
                        color: strong ? '#047857' : '#64748b',
                        border: `1px solid ${strong ? '#a7f3d0' : '#e2e8f0'}`,
                      }}
                    >
                      {v.score?.toFixed(1) || '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                      {slug || url}
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                      style={{
                        color: verdict.fg,
                        background: verdict.bg,
                        border: `1px solid ${verdict.border}`,
                      }}
                    >
                      {verdict.text}
                    </span>
                    <ArrowUpRight size={14} className="flex-none text-slate-400" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Superpowers */}
          <div>
            <div className="mb-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Profile
              </div>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
                Ваши superpowers
              </h2>
            </div>
            <div className="space-y-2">
              {profile?.superpowers?.map((sp: string, i: number) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-md border border-slate-200 bg-white p-3"
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-blue-50 font-mono text-[11px] font-semibold text-blue-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[13px] leading-[1.5] text-slate-700">{sp}</span>
                </div>
              ))}
            </div>
            {profile?.education && (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <GraduationCap size={11} />
                  Образование
                </div>
                <ul className="space-y-1 text-[12.5px] text-slate-700">
                  {profile.education.map((e: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-slate-400" />
                      <span>
                        {e.degree}
                        <span className="ml-1 text-slate-400">— {e.status}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* Proof points */}
        {profile?.proof_points && (
          <section className="mb-8">
            <div className="mb-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Proof
              </div>
              <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
                Ключевые достижения
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {profile.proof_points.map((p: any, i: number) => (
                <div
                  key={i}
                  className="tile flex gap-3 rounded-md border border-slate-200 bg-white p-4"
                >
                  <span className="check mt-1">
                    <Zap size={10} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium leading-[1.3] text-slate-900">
                      {p.title}
                    </div>
                    <div className="mt-1 text-[12px] leading-[1.4] text-slate-500">
                      {p.metric}
                    </div>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener"
                        className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-blue-600 hover:underline"
                      >
                        open <ArrowUpRight size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section className="mb-8">
          <div className="mb-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
              Shortcuts
            </div>
            <h2 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em]">
              Быстрые действия
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <QuickLink
              href="/matches"
              label="Топ матчи"
              sub="Вакансии с AI-скором ≥ 4.0"
              Icon={Star}
              tone="#2563eb"
            />
            <QuickLink
              href="/analytics"
              label="Аналитика"
              sub="Воронка + статистика"
              Icon={TrendingUp}
              tone="#047857"
            />
            <QuickLink
              href="/chat"
              label="AI советник"
              sub="Голосом или текстом"
              Icon={Sparkles}
              tone="#7c3aed"
            />
          </div>
        </section>

        {/* Footer timestamp */}
        {data?.lastRun && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-6 text-[12px] text-slate-500">
            <span>
              Последнее обновление: {new Date(data.lastRun).toLocaleString('ru-RU')}
            </span>
            <span className="inline-flex items-center gap-2 font-mono uppercase tracking-wider">
              <span className="pulse-dot" /> autopilot · live
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------
   Subcomponents
   ------------------------------------------------------------ */

function ProfileTile({
  label,
  Icon,
  tone,
  children,
}: {
  label: string
  Icon: any
  tone: string
  children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <Icon size={11} style={{ color: tone }} />
        {label}
      </div>
      {children}
    </div>
  )
}

function FunnelTile({
  label,
  value,
  Icon,
  tone,
}: {
  label: string
  value: number
  Icon: any
  tone: string
}) {
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
          n
        </span>
      </div>
      <div
        className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
        style={{ color: tone }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-slate-500">{label}</div>
    </div>
  )
}

function QuickLink({
  href,
  label,
  sub,
  Icon,
  tone,
}: {
  href: string
  label: string
  sub: string
  Icon: any
  tone: string
}) {
  return (
    <Link
      href={href}
      className="tile group flex items-start gap-3 rounded-md border border-slate-200 bg-white p-4 hover:bg-slate-50"
    >
      <span
        className="flex h-8 w-8 flex-none items-center justify-center rounded-md"
        style={{ background: `${tone}15`, color: tone }}
      >
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-slate-900">{label}</div>
        <div className="mt-0.5 text-[12px] text-slate-500">{sub}</div>
      </div>
      <ArrowUpRight
        size={14}
        className="flex-none text-slate-400 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}
