import Link from 'next/link'
import {
  Sparkles,
  LayoutDashboard,
  Star,
  ClipboardList,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Plug,
} from 'lucide-react'
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

  const workspaceNav = [
    { href: '/dashboard', label: 'Дашборд', Icon: LayoutDashboard },
    { href: '/matches', label: 'Новые матчи', Icon: Star },
    { href: '/pipeline', label: 'Pipeline', Icon: ClipboardList },
  ]

  const aiNav = [
    { href: '/chat', label: 'AI советник', Icon: MessageSquare },
    { href: '/analytics', label: 'Аналитика', Icon: BarChart3 },
  ]

  const accountNav = [
    { href: '/connect-hh', label: 'Подключить HH', Icon: Plug },
    { href: '/settings', label: 'Настройки', Icon: Settings },
  ]

  const sectionTitle =
    'px-3 pb-1 pt-4 font-mono text-[10px] uppercase tracking-wider text-slate-400'
  const linkClass =
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-[240px] flex-none flex-col border-r border-slate-200 bg-slate-50/50 p-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 px-3 py-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
            <Sparkles size={14} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-semibold tracking-tight">
              CareerPilot
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              workspace · v4.2
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="mt-4 flex-1 overflow-y-auto">
          <div className={sectionTitle}>Workspace</div>
          <div className="space-y-0.5">
            {workspaceNav.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={linkClass}>
                <Icon size={15} className="flex-none" strokeWidth={1.8} />
                {label}
              </Link>
            ))}
          </div>

          <div className={sectionTitle}>AI</div>
          <div className="space-y-0.5">
            {aiNav.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={linkClass}>
                <Icon size={15} className="flex-none" strokeWidth={1.8} />
                {label}
              </Link>
            ))}
          </div>

          <div className={sectionTitle}>Аккаунт</div>
          <div className="space-y-0.5">
            {accountNav.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={linkClass}>
                <Icon size={15} className="flex-none" strokeWidth={1.8} />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* User section at bottom */}
        <div className="mt-auto border-t border-slate-200 pt-3">
          {user ? (
            <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
              <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                {(user.email?.[0] || '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-slate-900">
                  {user.email?.split('@')[0] || 'user'}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {user.email}
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100"
            >
              Войти →
            </Link>
          )}
          {user && (
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut size={14} strokeWidth={1.8} />
                Выйти
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  )
}
