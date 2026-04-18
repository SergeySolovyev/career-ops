/**
 * GET /api/hh/session-status
 * Returns whether the current user has an active HH session captured.
 * Used by /matches to show "Connect HH" CTA vs scan button.
 */
import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ connected: false, reason: 'supabase_off' })
  }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ connected: false, reason: 'unauthorized' })

    const { data } = await supabase
      .from('hh_sessions')
      .select('status, hh_email, last_validated_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) return NextResponse.json({ connected: false })
    return NextResponse.json({
      connected: data.status === 'active',
      status: data.status,
      hh_email: data.hh_email,
      last_validated_at: data.last_validated_at,
      updated_at: data.updated_at,
    })
  } catch (e: any) {
    return NextResponse.json({ connected: false, error: e?.message }, { status: 500 })
  }
}
