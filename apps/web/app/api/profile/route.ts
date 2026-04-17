import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

function loadDemoProfile() {
  try {
    const filePath = join(process.cwd(), 'data', 'profile.json')
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

// Return the logged-in user's profile if present; otherwise Sergey demo profile.
export async function GET() {
  if (!isSupabaseConfigured()) {
    const demo = loadDemoProfile()
    return demo
      ? NextResponse.json({ ...demo, _source: 'demo' })
      : NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const demo = loadDemoProfile()
      return NextResponse.json({ ...demo, _source: 'demo' })
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      // Authenticated but no profile yet — return minimal stub, NOT Sergey's data
      return NextResponse.json({
        _source: 'user',
        _empty: true,
        candidate: {
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Новый пользователь',
          first_name: (user.user_metadata?.full_name || '').split(' ')[0] || 'Пользователь',
          email: user.email,
        },
      })
    }

    // Map DB row → same shape as demo profile (so frontend doesn't care)
    return NextResponse.json({
      _source: 'user',
      candidate: {
        full_name: data.full_name || user.email?.split('@')[0],
        first_name: (data.full_name || '').split(' ')[0] || 'Пользователь',
        email: user.email,
      },
      target: {
        roles: data.target_roles || [],
        salary_min: data.salary_min,
        salary_target_min: data.salary_min,
        salary_target_max: data.salary_max,
        currency: 'RUB',
      },
      cv_text: data.cv_text || '',
      positive_keywords: data.positive_keywords || [],
      negative_keywords: data.negative_keywords || [],
    })
  } catch (e) {
    console.error('[api/profile] GET error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Upsert the current user's profile. Requires auth.
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Whitelist fields + coerce types
    const row = {
      user_id: user.id,
      full_name: typeof body.full_name === 'string' ? body.full_name.slice(0, 200) : null,
      cv_text: typeof body.cv_text === 'string' ? body.cv_text.slice(0, 30000) : null,
      target_roles: Array.isArray(body.target_roles)
        ? body.target_roles.map(String).slice(0, 20)
        : null,
      salary_min: Number.isFinite(Number(body.salary_min)) ? Number(body.salary_min) : null,
      salary_max: Number.isFinite(Number(body.salary_max)) ? Number(body.salary_max) : null,
      positive_keywords: Array.isArray(body.positive_keywords)
        ? body.positive_keywords.map(String).slice(0, 50)
        : null,
      negative_keywords: Array.isArray(body.negative_keywords)
        ? body.negative_keywords.map(String).slice(0, 50)
        : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('user_profiles').upsert(row, { onConflict: 'user_id' })
    if (error) {
      console.error('[api/profile] upsert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[api/profile] POST error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
