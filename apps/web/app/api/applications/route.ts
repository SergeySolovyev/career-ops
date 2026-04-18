import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json([])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])
  const { data } = await supabase
    .from('application_log')
    .select('vacancy_url, vacancy_title, vacancy_company, status, applied_at, error_msg')
    .eq('user_id', user.id)
    .order('applied_at', { ascending: false })
    .limit(50)
  return NextResponse.json(data || [])
}
