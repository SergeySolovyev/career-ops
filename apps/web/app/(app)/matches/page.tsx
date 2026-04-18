import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import ScanButton from './scan-button'
import ApplyButton from './apply-button'

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

async function getEvaluations() {
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
    return data || []
  } catch {
    return []
  }
}

function formatSalary(from?: number | null, to?: number | null, cur?: string | null) {
  if (!from && !to) return null
  const f = from?.toLocaleString('ru-RU')
  const t = to?.toLocaleString('ru-RU')
  const c = cur === 'RUR' || cur === 'RUB' ? '₽' : cur || ''
  if (f && t) return `${f}–${t} ${c}`
  if (f) return `от ${f} ${c}`
  return `до ${t} ${c}`
}

function verdictBadge(v: string | null) {
  if (v === 'apply') return { text: 'apply', cls: 'bg-green-100 text-green-700' }
  if (v === 'maybe') return { text: 'maybe', cls: 'bg-yellow-100 text-yellow-800' }
  return { text: 'skip', cls: 'bg-gray-100 text-gray-600' }
}

export default async function MatchesPage() {
  const profile = await getProfile()
  const isUserProfile = profile?._source === 'user'

  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  const evaluations = isUserProfile ? await getEvaluations() : []

  return (
    <div>
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Новые матчи</h1>
          <p className="mt-1 text-muted-foreground">
            Вакансии, подобранные AI специально для вас
          </p>
        </div>
        {isUserProfile && <ScanButton />}
      </div>

      {!isUserProfile ? (
        // Anon / demo: keep one curated example for the landing demo
        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-border p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
                    4.7/5
                  </span>
                  <h3 className="text-lg font-semibold">Лидер направления по AI</h3>
                </div>
                <p className="mt-1 text-muted-foreground">Сбер · demo</p>
                <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                  <span>400-600K руб</span>
                  <span>Москва</span>
                </div>
              </div>
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
      ) : evaluations.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <div className="text-5xl">🔎</div>
          <h2 className="mt-4 text-lg font-semibold">Пока нет матчей</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Нажмите «Найти вакансии», чтобы AI просканировал hh.ru по вашим целевым ролям
            и оценил подходящие позиции под ваше CV.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Сканер использует ваши целевые роли из настроек. Скан занимает 30–60 секунд.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {evaluations.map((v) => {
            const badge = verdictBadge(v.ai_verdict as string | null)
            const salary = formatSalary(v.salary_from, v.salary_to, v.salary_currency)
            const score = (v.ai_score ?? 0).toFixed(1)
            const scoreCls = (v.ai_score ?? 0) >= 4
              ? 'bg-green-100 text-green-700'
              : (v.ai_score ?? 0) >= 3
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600'
            return (
              <div key={v.url} className="rounded-xl border border-border p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${scoreCls}`}>
                        {score}/5
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                      <h3 className="text-base font-semibold truncate">{v.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {v.company}
                      {v.location ? ` · ${v.location}` : ''}
                      {salary ? ` · ${salary}` : ''}
                    </p>
                    {v.ai_summary && (
                      <p className="mt-2 text-sm">{v.ai_summary}</p>
                    )}
                    {v.ai_strengths && v.ai_strengths.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                        {v.ai_strengths.slice(0, 3).map((s: string, i: number) => (
                          <li key={i}>✅ {s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener"
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary text-center"
                    >
                      Открыть в HH →
                    </a>
                    <ApplyButton vacancyUrl={v.url} score={v.ai_score ?? 0} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
