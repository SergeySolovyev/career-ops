import Link from 'next/link'
import { headers } from 'next/headers'

async function getStats() {
  try {
    const host = (await headers()).get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const res = await fetch(`${protocol}://${host}/api/stats`, { cache: 'no-store' })
    return res.json()
  } catch {
    return null
  }
}

const features = [
  {
    icon: '🔍',
    title: 'AI сканирует за вас',
    description: 'Система 24/7 мониторит hh.ru, LinkedIn, Telegram-каналы и 50+ карьерных страниц компаний.',
  },
  {
    icon: '🧠',
    title: '10-мерная оценка',
    description: 'Каждая вакансия оценивается по 10 критериям: fit, рост, компенсация, культура, stack и другие.',
  },
  {
    icon: '📄',
    title: 'Tailored CV + Cover Letter',
    description: 'Для каждого отклика — уникальное резюме и сопроводительное письмо, адаптированные под вакансию.',
  },
  {
    icon: '🚀',
    title: 'Авто-отклик',
    description: 'Нажмите одну кнопку — или включите автопилот. Система откликается, отправляет follow-up, трекает статусы.',
  },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: ['3 AI-оценки / месяц', 'Просмотр вакансий', 'Базовый трекер'],
    cta: 'Начать бесплатно',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/ мес',
    features: ['30 AI-оценок', 'Tailored CV (PDF)', 'Авто-отклик', 'Email-уведомления', 'Cover letter генерация'],
    cta: 'Попробовать Pro',
    highlighted: true,
  },
  {
    name: 'Premium',
    price: '$39',
    period: '/ мес',
    features: ['Безлимит оценок', 'Interview prep + STAR', 'Company research', 'Telegram-бот', 'Приоритетное сканирование'],
    cta: 'Получить Premium',
    highlighted: false,
  },
]

export default async function LandingPage() {
  const data = await getStats()
  const f = data?.funnel
  const s = data?.stats
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">CareerPilot</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Возможности
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              Тарифы
            </Link>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Войти
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Начать бесплатно
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          AI найдёт работу за вас
        </h1>
        <p className="mt-6 text-xl text-muted-foreground">
          Загрузите резюме — остальное сделаем мы. Сканирование вакансий, AI-оценка,
          генерация CV, авто-отклик — всё на автопилоте.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Открыть демо-кабинет
          </Link>
          <Link
            href="/chat"
            className="rounded-lg border border-border px-8 py-3 text-lg font-semibold hover:bg-secondary"
          >
            Спросить AI
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Демо с реальными данными. Без регистрации.
        </p>
      </section>

      {/* Social Proof */}
      <section className="border-y border-border bg-secondary/50 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-12 px-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{f?.found ?? '200+'}</div>
            <div className="text-sm text-muted-foreground">вакансий найдено</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{f?.aiEvaluated ?? 29}</div>
            <div className="text-sm text-muted-foreground">AI-отчётов</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{f?.recommended ?? 5}</div>
            <div className="text-sm text-muted-foreground">рекомендовано</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">{s?.avgScore ? `${s.avgScore}/5` : '4.7/5'}</div>
            <div className="text-sm text-muted-foreground">средний AI-скор</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24">
        <h2 className="text-center text-3xl font-bold">Полный автопилот</h2>
        <p className="mt-4 text-center text-muted-foreground">
          Нажали кнопку — ходите на собеседования
        </p>
        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border p-6">
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-secondary/30 px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold">Тарифы</h2>
          <p className="mt-4 text-center text-muted-foreground">
            Executive-grade качество для каждого
          </p>
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-8 ${
                  plan.highlighted
                    ? 'border-primary bg-white shadow-lg ring-1 ring-primary'
                    : 'border-border bg-white'
                }`}
              >
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                    plan.highlighted
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border hover:bg-secondary'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          <p>CareerPilot — AI-платформа поиска работы</p>
        </div>
      </footer>
    </div>
  )
}
