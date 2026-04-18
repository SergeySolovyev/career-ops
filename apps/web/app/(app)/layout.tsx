import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { signOut } from '../(auth)/login/actions'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user: { email?: string | null } | null = null
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const res = await supabase.auth.getUser()
      user = res.data.user
    } catch {
      user = null
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-secondary/30 p-4">
        <div className="mb-8">
          <span className="text-xl font-bold text-primary">CareerPilot</span>
        </div>
        <nav className="space-y-1">
          {[
            { href: '/dashboard', label: 'Дашборд', icon: '📊' },
            { href: '/matches', label: 'Новые матчи', icon: '⭐' },
            { href: '/chat', label: 'AI Советник', icon: '💬' },
            { href: '/analytics', label: 'Аналитика', icon: '📈' },
            { href: '/settings', label: 'Настройки', icon: '⚙️' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* User section at bottom */}
        <div className="mt-auto border-t border-border pt-4">
          {user && (
            <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
              {user.email}
            </div>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <span>🚪</span>
              Выйти
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
