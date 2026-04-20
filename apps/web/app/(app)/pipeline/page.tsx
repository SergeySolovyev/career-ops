import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Mail,
  Inbox,
  ExternalLink,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquareReply,
  Hourglass,
  AlertCircle,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

/* ============================================================
   CareerPilot · Pipeline
   Server component — preserves /api/profile + application_log query.
   Visual layer refreshed — Linear/Notion/Raycast aesthetic.
   ============================================================ */

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

async function getApplications() {
  if (!isSupabaseConfigured()) return []
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('application_log')
      .select(
        'vacancy_url, vacancy_title, vacancy_company, status, applied_at, error_msg, hh_response_id',
      )
      .eq('user_id', user.id)
      .order('applied_at', { ascending: false })
      .limit(100)
    return data || []
  } catch {
    return []
  }
}

type StatusKey =
  | 'queued'
  | 'sent'
  | 'failed'
  | 'already_applied'
  | 'viewed'
  | 'replied'
  | 'rejected'

const STATUS: Record<
  StatusKey | string,
  { text: string; fg: string; bg: string; border: string; Icon: any }
> = {
  queued: {
    text: 'В очереди',
    fg: '#475569',
    bg: '#f1f5f9',
    border: '#e2e8f0',
    Icon: Hourglass,
  },
  sent: {
    text: 'Отправлено',
    fg: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    Icon: Mail,
  },
  failed: {
    text: 'Ошибка',
    fg: '#b91c1c',
    bg: '#fef2f2',
    border: '#fecaca',
    Icon: XCircle,
  },
  already_applied: {
    text: 'Уже отправляли',
    fg: '#92400e',
    bg: '#fffbeb',
    border: '#fde68a',
    Icon: AlertCircle,
  },
  viewed: {
    text: 'Просмотрено',
    fg: '#6d28d9',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    Icon: Eye,
  },
  replied: {
    text: 'Ответили',
    fg: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    Icon: MessageSquareReply,
  },
  rejected: {
    text: 'Отказ',
    fg: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    Icon: XCircle,
  },
}

const DEMO_APPS = [
  {
    title: 'Лидер направления по AI',
    company: 'Сбер',
    status: 'sent' as StatusKey,
    date: '2026-04-16',
  },
  {
    title: 'Head of Data Platform',
    company: 'Mokka',
    status: 'sent' as StatusKey,
    date: '2026-04-15',
  },
  {
    title: 'Chief Digital Officer',
    company: 'Cornerstone Russia',
    status: 'viewed' as StatusKey,
    date: '2026-04-14',
  },
  {
    title: 'Руководитель AI-трансформации',
    company: 'Крупный российский банк',
    status: 'replied' as StatusKey,
    date: '2026-04-12',
  },
]

export default async function PipelinePage() {
  const profile = await getProfile()
  const isUserProfile = profile?._source === 'user'

  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  const apps = isUserProfile ? await getApplications() : []

  // Count by status for summary strip
  const countStatus = (keys: StatusKey[]) => {
    if (!isUserProfile) {
      return DEMO_APPS.filter((a) => keys.includes(a.status)).length
    }
    return apps.filter((a) => keys.includes(a.status as StatusKey)).length
  }

  const summary = {
    total: isUserProfile ? apps.length : DEMO_APPS.length,
    sent: countStatus(['sent']),
    active: countStatus(['viewed', 'replied']),
    failed: countStatus(['failed', 'rejected']),
  }

  return (
    <div className="-m-8 min-h-screen bg-white text-slate-900 antialiased">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-900">
            Workspace
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">Pipeline</span>
        </div>

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] grad-text">
              Pipeline откликов
            </h1>
            <p className="mt-3 max-w-[540px] text-[15px] leading-[1.55] text-slate-500">
              История AI-откликов через CareerPilot. Статусы обновляются по мере
              того, как HR просматривают и отвечают.
            </p>
          </div>
          {isUserProfile && apps.length > 0 && (
            <span className="pill">
              <span className="pulse-dot" />
              tracking · live
            </span>
          )}
        </header>

        {/* Demo banner */}
        {!isUserProfile && (
          <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-[13px] text-blue-900">
            <span className="font-semibold">Demo-режим.</span>{' '}
            Это публичный pipeline Сергея с реальными данными.{' '}
            <Link href="/signup" className="font-semibold underline">
              Зарегистрируйтесь
            </Link>{' '}
            — и увидите свой.
          </div>
        )}

        {/* Summary strip */}
        {(isUserProfile ? apps.length > 0 : true) && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryTile label="Всего откликов" value={summary.total} tone="#0f172a" />
            <SummaryTile label="Отправлено" value={summary.sent} tone="#2563eb" />
            <SummaryTile label="Активны" value={summary.active} tone="#047857" />
            <SummaryTile label="Ошибки / отказы" value={summary.failed} tone="#dc2626" />
          </div>
        )}

        {/* Empty for auth'd with no apps */}
        {isUserProfile && apps.length === 0 ? (
          <div className="card flex flex-col items-center py-16 px-6 text-center">
            <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Inbox size={22} />
              <span
                className="absolute -inset-2 -z-10 rounded-2xl opacity-50 blur-xl"
                style={{
                  background:
                    'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)',
                }}
              />
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-slate-500">
              Inbox · zero-state
            </div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.01em]">
              Откликов пока нет
            </h2>
            <p className="mt-2 max-w-[400px] text-[13px] text-slate-500">
              Перейдите в «Новые матчи» и нажмите «Откликнуться» на интересную
              вакансию. AI сгенерирует персональное cover-letter и отправит через
              HH.
            </p>
            <Link href="/matches" className="btn-primary mt-6 h-10 px-5 text-[13px]">
              ⭐ Перейти к матчам
              <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : (
          <PipelineTable
            apps={isUserProfile ? apps : []}
            demoApps={!isUserProfile ? DEMO_APPS : []}
            isDemo={!isUserProfile}
          />
        )}

        {/* Footer */}
        {isUserProfile && apps.length > 0 && (
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6 text-[12px] text-slate-500">
            <span>Показано {apps.length} из ≤ 100</span>
            <span className="inline-flex items-center gap-2 font-mono uppercase tracking-wider">
              <span className="pulse-dot" /> sync · every 4h
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

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="card p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
        style={{ color: tone }}
      >
        {value}
      </div>
    </div>
  )
}

function PipelineTable({
  apps,
  demoApps,
  isDemo,
}: {
  apps: any[]
  demoApps: typeof DEMO_APPS
  isDemo: boolean
}) {
  const rows = isDemo
    ? demoApps.map((a) => ({
        title: a.title,
        company: a.company,
        status: a.status as StatusKey,
        when: a.date,
        url: null as string | null,
        error: null as string | null,
      }))
    : apps.map((a) => ({
        title: (a.vacancy_title as string) || '—',
        company: (a.vacancy_company as string) || '—',
        status: ((a.status as string) || 'queued') as StatusKey,
        when: a.applied_at
          ? new Date(a.applied_at as string).toLocaleString('ru-RU', {
              dateStyle: 'short',
              timeStyle: 'short',
            })
          : '—',
        url: (a.vacancy_url as string) || null,
        error: (a.error_msg as string) || null,
      }))

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[1fr_220px_160px_140px_44px] border-b border-slate-200 bg-slate-50/60 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        <div>Вакансия</div>
        <div>Компания</div>
        <div>Статус</div>
        <div>Когда</div>
        <div></div>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((r, i) => {
          const s = STATUS[r.status] || STATUS.queued
          const Icon = s.Icon
          return (
            <div
              key={i}
              className="grid grid-cols-[1fr_220px_160px_140px_44px] items-center px-4 py-3 text-[13px] hover:bg-slate-50/60"
            >
              <div className="min-w-0 pr-3">
                <div className="truncate font-medium text-slate-900">
                  {r.title}
                </div>
                {r.error && (
                  <div
                    className="mt-0.5 line-clamp-1 font-mono text-[10.5px] text-red-600"
                    title={r.error}
                  >
                    {r.error}
                  </div>
                )}
              </div>
              <div className="truncate text-slate-600">{r.company}</div>
              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider"
                  style={{ color: s.fg, background: s.bg, borderColor: s.border }}
                >
                  <Icon size={10} />
                  {s.text}
                </span>
              </div>
              <div className="font-mono text-[11.5px] text-slate-500 tabular-nums">
                {r.when}
              </div>
              <div className="text-right">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                    title="Открыть"
                  >
                    <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
