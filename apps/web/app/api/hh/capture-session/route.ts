/**
 * POST /api/hh/capture-session
 *
 * Triggered by /onboarding step 4 once the user has logged into HH inside
 * our embedded Browserless session. We extract cookies for hh.ru, encrypt,
 * and store them in `hh_sessions` so the scan/apply jobs can restore them.
 *
 * Body shape (one of):
 *   { cookies: Cookie[] }            // pre-collected cookies
 *   { browserlessSessionId: string } // future: trigger remote extraction
 *
 * The embedded UI (Connect HH page) collects cookies via Playwright's
 * page.context().cookies() and POSTs them here.
 */
import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { encryptJson } from '@/lib/encryption'

interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Lax' | 'None' | 'Strict'
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const cookies: Cookie[] = Array.isArray(body?.cookies) ? body.cookies : []
    const hhEmail: string | null = typeof body?.hh_email === 'string' ? body.hh_email : null

    // Validate — at least one hh.ru cookie must be present and look like an auth cookie.
    // HH uses `hhtoken`, `hhuid`, `_xsrf`, etc. We require at least 3 hh.ru cookies.
    const hhCookies = cookies.filter((c) => c.domain && c.domain.includes('hh.ru'))
    if (hhCookies.length < 3) {
      return NextResponse.json(
        { error: `Expected at least 3 hh.ru cookies, got ${hhCookies.length}. Did you log in?` },
        { status: 400 },
      )
    }

    const { iv, ciphertext } = encryptJson({ cookies: hhCookies, capturedAt: new Date().toISOString() })

    const { error } = await supabase
      .from('hh_sessions')
      .upsert(
        {
          user_id: user.id,
          iv,
          ciphertext,
          hh_email: hhEmail,
          status: 'active',
          last_validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (error) {
      console.error('[hh/capture-session] upsert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, cookieCount: hhCookies.length })
  } catch (e: any) {
    console.error('[hh/capture-session] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
