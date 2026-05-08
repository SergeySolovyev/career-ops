import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { checkCsrfOrigin } from '@/lib/csrf'

export async function middleware(request: NextRequest) {
  // CSRF: Origin guard on state-changing /api/* requests.
  // Skip /api/telegram/webhook — Telegram doesn't send Origin and we use
  // X-Telegram-Bot-Api-Secret-Token signature verification instead.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (request.nextUrl.pathname !== '/api/telegram/webhook') {
      const csrfRes = checkCsrfOrigin(request)
      if (csrfRes) return csrfRes
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
