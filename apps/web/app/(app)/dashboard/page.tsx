import { headers } from 'next/headers'
import Link from 'next/link'
import { readFileSync } from 'fs'
import { join } from 'path'

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

function loadJSON(filename: string) {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data', filename), 'utf-8'))
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const data = await getStats()
  const profile = loadJSON('profile.json')
  const evalLog = loadJSON('auto-eval-log.json') || { evaluated: {} }

  const stats = data?.funnel ? {
    found: data.funnel.found,
    evaluated: data.funnel.aiEvaluated,
    recommended: data.funnel.recommended,
    applied: data.funnel.applied,
    interviews: data.funnel.interviews,
  } : { found: 0, evaluated: 0, recommended: 0, applied: 0, interviews: 0 }

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
    <div>
      {/* Personal greeting */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{greeting}, {firstName}! 👋</h1>
          <p className="mt-2 text-muted-foreground">
            {candidate?.current_role || 'Ваш личный AI помощник по поиску работы'}
          </p>
        </div>
        <Link
          href="/chat"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          💬 Спросить AI советника
        </Link>
      </div>

      {/* Profile card */}
      {profile && (
        <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Целевые роли</div>
              <ul className="mt-2 space-y-1 text-sm">
                {target?.roles?.slice(0, 3).map((r: string) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Вилка зарплаты</div>
              <div className="mt-2 text-lg font-semibold">
                {target?.salary_target_min?.toLocaleString('ru-RU')}–{target?.salary_target_max?.toLocaleString('ru-RU')} ₽
              </div>
              <div className="text-xs text-muted-foreground">
                {target?.international_range} international
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-muted-foreground">Контакты</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>📍 {candidate?.location}</div>
                <div>📧 {candidate?.email}</div>
                <div>📱 {candidate?.telegram}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <h2 className="mt-10 text-lg font-semibold">Воронка поиска</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-5">
        {[
          { label: 'Найдено', value: stats.found, color: 'text-blue-600', emoji: '🔍' },
          { label: 'Оценено AI', value: stats.evaluated, color: 'text-purple-600', emoji: '🤖' },
          { label: 'Рекомендовано', value: stats.recommended, color: 'text-green-600', emoji: '⭐' },
          { label: 'Отклики', value: stats.applied, color: 'text-orange-600', emoji: '📧' },
          { label: 'Интервью', value: stats.interviews, color: 'text-red-600', emoji: '💼' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border p-5">
            <div className="text-xl">{stat.emoji}</div>
            <div className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Two-column: recent activity + superpowers */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold">Топ AI-матчей</h2>
          <div className="mt-4 space-y-2">
            {recentEvals.length === 0 && (
              <p className="text-sm text-muted-foreground">Пока нет оценок.</p>
            )}
            {recentEvals.map(([url, v]) => {
              const slug = (v.report || '').replace('.md', '').replace(/^\d+-/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-/g, ' ')
              const verdict = v.status === 'apply' ? { text: 'apply', color: 'bg-green-100 text-green-700' }
                : v.status === 'maybe' ? { text: 'maybe', color: 'bg-yellow-100 text-yellow-700' }
                : { text: 'skip', color: 'bg-gray-100 text-gray-600' }
              return (
                <a key={url} href={url} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/40">
                  <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${v.score >= 4 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {v.score?.toFixed(1) || '—'}
                  </span>
                  <span className="flex-1 truncate text-sm">{slug || url}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${verdict.color}`}>
                    {verdict.text}
                  </span>
                </a>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Ваши superpowers</h2>
          <div className="mt-4 space-y-2">
            {profile?.superpowers?.map((sp: string, i: number) => (
              <div key={i} className="rounded-lg border border-border p-3 text-sm">
                <span className="mr-2 text-primary font-bold">{i + 1}.</span>
                {sp}
              </div>
            ))}
          </div>
          {profile?.education && (
            <div className="mt-4 rounded-lg bg-secondary/30 p-4">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Образование</div>
              <ul className="mt-2 space-y-1 text-sm">
                {profile.education.map((e: any, i: number) => (
                  <li key={i}>🎓 {e.degree} — <span className="text-muted-foreground">{e.status}</span></li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Proof points */}
      {profile?.proof_points && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Ключевые достижения (proof points)</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {profile.proof_points.map((p: any, i: number) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="font-semibold text-sm">{p.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.metric}</div>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener" className="mt-2 inline-block text-xs text-primary hover:underline">
                    Открыть →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Быстрые действия</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Link href="/matches" className="rounded-xl border border-border p-6 hover:bg-secondary transition-colors">
            <div className="text-2xl">⭐</div>
            <h3 className="mt-2 font-semibold">Топ матчи</h3>
            <p className="mt-1 text-sm text-muted-foreground">Вакансии с AI-скором ≥ 4.0</p>
          </Link>
          <Link href="/analytics" className="rounded-xl border border-border p-6 hover:bg-secondary transition-colors">
            <div className="text-2xl">📈</div>
            <h3 className="mt-2 font-semibold">Аналитика</h3>
            <p className="mt-1 text-sm text-muted-foreground">Воронка + статистика</p>
          </Link>
          <Link href="/chat" className="rounded-xl border border-border p-6 hover:bg-secondary transition-colors">
            <div className="text-2xl">💬</div>
            <h3 className="mt-2 font-semibold">AI советник</h3>
            <p className="mt-1 text-sm text-muted-foreground">Задай вопрос голосом или текстом</p>
          </Link>
        </div>
      </section>

      {data?.lastRun && (
        <p className="mt-8 text-xs text-muted-foreground">
          Последнее обновление данных: {new Date(data.lastRun).toLocaleString('ru-RU')}
        </p>
      )}
    </div>
  )
}
