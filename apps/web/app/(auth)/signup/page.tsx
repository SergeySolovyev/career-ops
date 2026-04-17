import Link from 'next/link'
import { signUp } from './actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Создать аккаунт</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Бесплатно. 3 AI-оценки в месяц. Без карты.
        </p>

        {params.error === 'supabase_disabled' ? (
          <div className="mt-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            Регистрация в demo-режиме отключена.{' '}
            <Link href="/dashboard" className="font-medium underline">
              Открыть демо-кабинет →
            </Link>
          </div>
        ) : params.error ? (
          <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </div>
        ) : null}

        <form action={signUp} className="mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Имя
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Иван Иванов"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Минимум 8 символов"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Создать аккаунт
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
