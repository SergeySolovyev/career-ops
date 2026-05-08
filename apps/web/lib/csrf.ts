import { NextRequest, NextResponse } from 'next/server'

/**
 * Origin/Referer guard against CSRF for state-changing API requests.
 * Rejects POST/PUT/PATCH/DELETE if Origin doesn't match VERCEL_URL or
 * NEXT_PUBLIC_SITE_URL. GET requests are safe by default.
 *
 * Returns NextResponse 403 on failure, or null on success.
 *
 * Same-origin browser requests automatically include Origin header.
 * Server-side fetches (e.g. from another API route) won't have Origin
 * — those are NOT bound by this check (we trust our own backend).
 */
export function checkCsrfOrigin(req: NextRequest | Request): NextResponse | null {
  const method = req.method?.toUpperCase()
  if (!method || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null
  }

  const origin = req.headers.get('origin')
  // No Origin header = either same-origin GET or server-to-server fetch — allow.
  if (!origin) return null

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'https://careerpilot-umber.vercel.app', // production canonical
  ].filter(Boolean) as string[]

  // Allow Vercel preview URLs (*.vercel.app under our scope)
  const isVercelPreview = /^https:\/\/careerpilot-[a-z0-9]+-sergeys-projects-04c8641c\.vercel\.app$/.test(origin)

  if (allowedOrigins.includes(origin) || isVercelPreview) {
    return null
  }

  console.warn(`[csrf] rejected origin: ${origin}`)
  return NextResponse.json(
    { error: 'Origin не разрешён' },
    { status: 403 },
  )
}
