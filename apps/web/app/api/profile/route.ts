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

// Canonical defaults for migration 004 fields. Used both for empty user rows
// and for the demo profile (profile.json predates these fields).
const DEFAULTS = {
  icp_segment: 'middle' as const,
  skills: [] as string[],
  experience_years: 0,
  city: null as string | null,
  remote_ok: true,
}

// Return the logged-in user's profile if present; otherwise Sergey demo profile.
export async function GET() {
  if (!isSupabaseConfigured()) {
    const demo = loadDemoProfile()
    return demo
      ? NextResponse.json({ ...demo, ...DEFAULTS, _source: 'demo' })
      : NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const demo = loadDemoProfile()
      return NextResponse.json({ ...demo, ...DEFAULTS, _source: 'demo' })
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      // Authenticated but no profile yet — return minimal stub with defaults
      return NextResponse.json({
        _source: 'user',
        _empty: true,
        _has_cv: false,
        _has_goals: false,
        _onboarding_complete: false,
        candidate: {
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Новый пользователь',
          first_name: (user.user_metadata?.full_name || '').split(' ')[0] || 'Пользователь',
          email: user.email,
        },
        ...DEFAULTS,
        cv_text: '',
      })
    }

    // Stage-specific completion flags — let consumers (matches/dashboard/onboarding)
    // route the user precisely instead of guessing from the legacy _empty bit.
    // _has_cv mirrors Step 1 validation (cv.trim().length >= 100)
    // _has_goals mirrors Step 2 save (target_roles non-empty array)
    const cvText = typeof data.cv_text === 'string' ? data.cv_text : ''
    const targetRolesArr = Array.isArray(data.target_roles) ? data.target_roles : []
    const hasCv = cvText.trim().length >= 100
    const hasGoals = targetRolesArr.length > 0

    // Map DB row → same shape as demo profile (so frontend doesn't care)
    return NextResponse.json({
      _source: 'user',
      _empty: false,
      _has_cv: hasCv,
      _has_goals: hasGoals,
      _onboarding_complete: hasCv && hasGoals,
      candidate: {
        full_name: data.full_name || user.email?.split('@')[0],
        first_name: (data.full_name || '').split(' ')[0] || 'Пользователь',
        email: user.email,
      },
      target: {
        roles: targetRolesArr,
        salary_min: data.salary_min,
        salary_target_min: data.salary_min,
        salary_target_max: data.salary_max,
        currency: 'RUB',
      },
      // Migration 004 fields — surfaced at top level (locked contract for Subagent C)
      icp_segment: data.icp_segment ?? DEFAULTS.icp_segment,
      skills: Array.isArray(data.skills) ? data.skills : DEFAULTS.skills,
      experience_years: typeof data.experience_years === 'number' ? data.experience_years : DEFAULTS.experience_years,
      city: data.city ?? DEFAULTS.city,
      remote_ok: typeof data.remote_ok === 'boolean' ? data.remote_ok : DEFAULTS.remote_ok,
      cv_text: cvText,
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

    // Partial update: only include fields that are actually present in the body.
    // This lets the onboarding flow save fields across steps without clobbering
    // previously-saved data (e.g. step 2 must not wipe the CV from step 1).
    const row: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }
    if ('full_name' in body) {
      row.full_name =
        typeof body.full_name === 'string' ? body.full_name.slice(0, 200) : null
    }
    if ('cv_text' in body) {
      row.cv_text =
        typeof body.cv_text === 'string' ? body.cv_text.slice(0, 30000) : null
    }
    if ('target_roles' in body) {
      row.target_roles = Array.isArray(body.target_roles)
        ? body.target_roles.map(String).slice(0, 20)
        : null
    }
    if ('salary_min' in body) {
      row.salary_min = Number.isFinite(Number(body.salary_min))
        ? Number(body.salary_min)
        : null
    }
    if ('salary_max' in body) {
      row.salary_max = Number.isFinite(Number(body.salary_max))
        ? Number(body.salary_max)
        : null
    }
    if ('positive_keywords' in body) {
      row.positive_keywords = Array.isArray(body.positive_keywords)
        ? body.positive_keywords.map(String).slice(0, 50)
        : null
    }
    if ('negative_keywords' in body) {
      row.negative_keywords = Array.isArray(body.negative_keywords)
        ? body.negative_keywords.map(String).slice(0, 50)
        : null
    }
    // Migration 004 fields
    if ('icp_segment' in body) {
      const v = body.icp_segment
      row.icp_segment = v === 'junior' || v === 'middle' || v === 'senior' ? v : 'middle'
    }
    if ('skills' in body) {
      row.skills = Array.isArray(body.skills)
        ? body.skills.map(String).slice(0, 50)
        : []
    }
    if ('experience_years' in body) {
      const n = Number(body.experience_years)
      row.experience_years = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
    }
    if ('city' in body) {
      row.city = typeof body.city === 'string' ? body.city.slice(0, 120) : null
    }
    if ('remote_ok' in body) {
      row.remote_ok = typeof body.remote_ok === 'boolean' ? body.remote_ok : true
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

// PATCH is an alias for POST — both perform a partial upsert. The locked
// API contract for Subagent C uses PATCH semantically; keeping POST for
// backward compat with existing onboarding flow.
export const PATCH = POST
