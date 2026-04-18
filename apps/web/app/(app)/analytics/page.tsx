import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
  { key: 'found', label: 'Найдено вакансий', color: 'bg-blue-500' },
  { key: 'preScreened', label: 'Прошли pre-screen', color: 'bg-indigo-500' },
  { key: 'aiEvaluated', label: 'Оценены AI', color: 'bg-purple-500' },
  { key: 'recommended', label: 'Рекомендовано (apply/maybe)', color: 'bg-green-500' },
  { key: 'applied', label: 'Отклик отправлен', color: 'bg-orange-500' },
  { key: 'interviews', label: 'Интервью', color: 'bg-red-500' },
  { key: 'offers', label: 'Офферы', color: 'bg-yellow-500' },
]

export default async function AnalyticsPage() {
  const [data, profile] = await Promise.all([getStats(), getProfile()])
  const isUserProfile = profile?._source === 'user'

  // New authenticated users without a CV: send to onboarding first
  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  if (!data || !data.funnel) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Аналитика воронки</h1>
        <p className="mt-4 text-muted-foreground">Данные недоступны</p>
      </div>
    )
  }

  // Authenticated users start with empty funnel — show empty state with CTA.
  if (isUserProfile && (data.funnel.found || 0) === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Аналитика воронки</h1>
        <p className="mt-1 text-muted-foreground">
          Конверсия от обнаружения вакансии до оффера
        </p>
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <div className="text-5xl">📊</div>
          <h2 className="mt-4 text-lg font-semibold">Пока нет данных</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Воронка появится после первых сканов и AI-оценок вакансий.
            Сканер запускается раз в 4 часа.
          </p>
          <div className="mt-6">
            <Link
              href="/settings"
              className="inline-block rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              ⚙️ Настроить ключевые слова
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { funnel, stats, topVacancies } = data
  const maxCount = funnel.found || 1

  return (
    <div>
      <h1 className="text-2xl font-bold">Аналитика воронки</h1>
      <p className="mt-1 text-muted-foreground">
        Конверсия от обнаружения вакансии до оффера
      </p>

      {/* Funnel visualization */}
      <div className="mt-8 space-y-3">
        {FUNNEL_STAGES.map((stage) => {
          const count = funnel[stage.key] || 0
          const width = Math.max((count / maxCount) * 100, 2)
          const conversion = stage.key === 'found'
            ? '100%'
            : `${((count / maxCount) * 100).toFixed(1)}%`

          return (
            <div key={stage.key} className="flex items-center gap-4">
              <div className="w-48 text-sm text-right text-muted-foreground shrink-0">
                {stage.label}
              </div>
              <div className="flex-1">
                <div
                  className={`${stage.color} h-8 rounded-r-lg flex items-center px-3 transition-all duration-500`}
                  style={{ width: `${width}%` }}
                >
                  <span className="text-sm font-semibold text-white">{count}</span>
                </div>
              </div>
              <div className="w-16 text-sm text-muted-foreground shrink-0">
                {conversion}
              </div>
            </div>
          )
        })}
      </div>

      {/* Key metrics */}
      <div className="mt-12 grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-6">
          <div className="text-3xl font-bold text-blue-600">{stats.totalEvaluated}</div>
          <div className="mt-1 text-sm text-muted-foreground">Всего обработано</div>
        </div>
        <div className="rounded-xl border border-border p-6">
          <div className="text-3xl font-bold text-purple-600">{stats.avgScore}</div>
          <div className="mt-1 text-sm text-muted-foreground">Средний AI-скор</div>
        </div>
        <div className="rounded-xl border border-border p-6">
          <div className="text-3xl font-bold text-green-600">{stats.applyRate}%</div>
          <div className="mt-1 text-sm text-muted-foreground">Конверсия в рекомендацию</div>
        </div>
        <div className="rounded-xl border border-border p-6">
          <div className="text-3xl font-bold text-orange-600">{stats.topScore}</div>
          <div className="mt-1 text-sm text-muted-foreground">Максимальный скор</div>
        </div>
      </div>

      {/* Top vacancies */}
      {topVacancies && topVacancies.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold">Топ-5 вакансий</h2>
          <div className="mt-4 space-y-2">
            {topVacancies.map((v: any, i: number) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-3">
                <span className="rounded-md bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
                  {v.score}/5
                </span>
                <span className="text-sm">{v.report?.replace('.md', '').replace(/^\d+-/, '') || v.url}</span>
                <a href={v.url} target="_blank" rel="noopener" className="ml-auto text-xs text-primary hover:underline">
                  hh.ru
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
