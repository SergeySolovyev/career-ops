import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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

export default async function MatchesPage() {
  const profile = await getProfile()
  const isUserProfile = profile?._source === 'user'

  // New authenticated users without a CV: send to onboarding first
  if (isUserProfile && profile?._empty) {
    redirect('/onboarding')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Новые матчи</h1>
      <p className="mt-1 text-muted-foreground">
        Вакансии, подобранные AI специально для вас
      </p>

      {isUserProfile ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
          <div className="text-5xl">🔎</div>
          <h2 className="mt-4 text-lg font-semibold">Пока нет матчей</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            AI ещё не оценил вакансии под ваш профиль. Сканер запускается раз в 4 часа —
            первые матчи появятся здесь автоматически.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/chat"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              💬 Спросить AI советника
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              ⚙️ Настроить ключевые слова
            </Link>
          </div>
        </div>
      ) : (
        // Anon / demo: keep showing the curated example so the landing demo
        // remains illustrative for new visitors.
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

            <div className="mt-4">
              <h4 className="text-sm font-medium">Почему подходит:</h4>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• AI + банкинг = ваш профиль</li>
                <li>• 20 лет финрынков — seniority match</li>
                <li>• Research papers — доказательство экспертизы</li>
              </ul>
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
      )}
    </div>
  )
}
