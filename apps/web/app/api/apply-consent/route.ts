import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ agreed: false })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ agreed: false })
  const { data } = await supabase
    .from('apply_consent')
    .select('agreed_at')
    .eq('user_id', user.id)
    .maybeSingle()
  return NextResponse.json({ agreed: !!data, agreed_at: data?.agreed_at || null })
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await supabase
    .from('apply_consent')
    .upsert(
      {
        user_id: user.id,
        agreed_at: new Date().toISOString(),
        ip,
        user_agent: userAgent,
      },
      { onConflict: 'user_id' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
