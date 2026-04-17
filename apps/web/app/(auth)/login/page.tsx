import Link from 'next/link'
import { signIn } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">Войти в CareerPilot</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Введите email и пароль для входа
        </p>

        {params.error && (
          <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error}
          </div>
        )}

        <form action={signIn} className="mt-8 space-y-4">
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
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Войти
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Нет аккаунта?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  )
}
