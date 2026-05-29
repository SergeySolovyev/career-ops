import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Graceful fallback: if Supabase is not configured, skip auth checks
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users from protected routes.
  //
  // Public (anon) routes: /, /chat, /dashboard, /matches, /analytics, /pipeline
  //   — anon sees Sergey demo data (promised on landing "Демо без регистрации").
  // Protected: /settings, /onboarding, /connect-hh — personal workspace, need auth.
  const protectedPaths = ['/settings', '/onboarding', '/connect-hh']
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users from auth pages.
  // If they arrived with intent=pro|premium (clicked a paid CTA from landing
  // while already signed in), route them to /onboarding so the existing CV →
  // checkout flow picks up. Without this branch, intent silently dies on
  // /dashboard — a conversion blocker for returning visitors.
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    const url = request.nextUrl.clone()
    const intent = request.nextUrl.searchParams.get('intent')
    if (intent === 'pro' || intent === 'premium') {
      url.pathname = '/onboarding'
      // searchParams (intent, promo) are preserved automatically by clone()
    } else {
      url.pathname = '/dashboard'
      // strip any stray intent/promo from the URL (would clutter dashboard)
      url.searchParams.delete('intent')
      url.searchParams.delete('promo')
    }
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
