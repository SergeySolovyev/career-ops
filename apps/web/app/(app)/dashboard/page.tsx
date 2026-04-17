import { headers } from 'next/headers'
import Link from 'next/link'

async function getStats() {
  const host = (await headers()).get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  try {
    const res = await fetch(`${protocol}://${host}/api/stats`, { cache: 'no-store' })
    return res.json()
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const data = await getStats()

  const stats = data?.funnel ? {
    found: data.funnel.found,
    evaluated: data.funnel.aiEvaluated,
    recommended: data.funnel.recommended,
    applied: data.funnel.applied,
    interviews: data.funnel.interviews,
  } : {
    found: 0, evaluated: 0, recommended: 0, applied: 0, interviews: 0,
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Дашборд</h1>
      <p className="mt-1 text-muted-foreground">Обзор вашего поиска работы</p>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-5">
        {[
          { label: 'Найдено', value: stats.found, color: 'text-blue-600' },
          { label: 'Оценено AI', value: stats.evaluated, color: 'text-purple-600' },
          { label: 'Рекомендовано', value: stats.recommended, color: 'text-green-600' },
          { label: 'Отклики', value: stats.applied, color: 'text-orange-600' },
          { label: 'Собеседования', value: stats.interviews, color: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border p-6">
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <Link href="/chat" className="rounded-xl border border-border p-6 hover:bg-secondary transition-colors">
          <div className="text-2xl">💬</div>
          <h3 className="mt-2 font-semibold">AI Советник</h3>
          <p className="mt-1 text-sm text-muted-foreground">Задайте вопрос о карьере или вакансиях</p>
        </Link>
        <Link href="/matches" className="rounded-xl border border-border p-6 hover:bg-secondary transition-colors">
          <div className="text-2xl">⭐</div>
          <h3 className="mt-2 font-semibold">Новые матчи</h3>
          <p className="mt-1 text-sm text-muted-foreground">Вакансии подобранные AI</p>
        </Link>
        <Link href="/analytics" className="rounded-xl border border-border p-6 hover:bg-secondary transition-colors">
          <div className="text-2xl">📈</div>
          <h3 className="mt-2 font-semibold">Аналитика воронки</h3>
          <p className="mt-1 text-sm text-muted-foreground">Конверсия и статистика</p>
        </Link>
      </div>

      {data?.lastRun && (
        <p className="mt-8 text-xs text-muted-foreground">
          Последнее обновление: {new Date(data.lastRun).toLocaleString('ru-RU')}
        </p>
      )}
    </div>
  )
}
