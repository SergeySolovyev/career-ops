import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('application_log')
      .select('vacancy_url, vacancy_title, vacancy_company, status, applied_at, error_msg, hh_response_id')
      .eq('user_id', user.id)
      .order('applied_at', { ascending: false })
      .limit(100)
    return data || []
  } catch {
    return []
  }
}

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  queued: { text: 'В очереди', cls: 'bg-gray-100 text-gray-700' },
  sent: { text: 'Отправлено', cls: 'bg-blue-100 text-blue-700' },
  failed: { text: 'Ошибка', cls: 'bg-red-100 text-red-700' },
  already_applied: { text: 'Уже отправляли', cls: 'bg-yellow-100 text-yellow-800' },
  viewed: { text: 'Просмотрено', cls: 'bg-purple-100 text-purple-700' },
  replied: { text: 'Ответили', cls: 'bg-green-100 text-green-700' },
  rejected: { text: 'Отказ', cls: 'bg-gray-200 text-gray-700' },
}

export default async function PipelinePage() {
  const profile = await getProfile()
  const isUserProfile = profile?._source === 'user'

  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  const apps = isUserProfile ? await getApplications() : []

  return (
    <div>
      <h1 className="text-2xl font-bold">Pipeline откликов</h1>
      <p className="mt-1 text-muted-foreground">
        История ваших AI-откликов через CareerPilot
      </p>

      {!isUserProfile ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <div className="text-5xl">🔐</div>
          <p className="mt-4 text-sm text-muted-foreground">
            Pipeline доступен только залогиненным пользователям.{' '}
            <Link href="/signup" className="font-semibold underline">
              Зарегистрируйтесь
            </Link>
            .
          </p>
        </div>
      ) : apps.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <div className="text-5xl">📭</div>
          <h2 className="mt-4 text-lg font-semibold">Откликов пока нет</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Перейдите в «Новые матчи» и нажмите «Откликнуться» на интересную вакансию.
          </p>
          <Link
            href="/matches"
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            ⭐ Перейти к матчам
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-secondary/30">
              <tr className="text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-4 py-3">Вакансия</th>
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Когда</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apps.map((a, i) => {
                const badge = STATUS_BADGE[a.status as string] || { text: a.status, cls: 'bg-gray-100 text-gray-600' }
                const when = a.applied_at
                  ? new Date(a.applied_at as string).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'
                return (
                  <tr key={i} className="hover:bg-secondary/20">
                    <td className="px-4 py-3 font-medium">{a.vacancy_title || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.vacancy_company || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.text}</span>
                      {a.error_msg && (
                        <div className="mt-1 text-xs text-destructive line-clamp-1" title={a.error_msg as string}>
                          {a.error_msg}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{when}</td>
                    <td className="px-4 py-3">
                      <a
                        href={a.vacancy_url as string}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-primary hover:underline"
                      >
                        Открыть →
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
