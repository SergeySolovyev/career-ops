'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { isEmailWhitelisted, WHITELIST_REJECT_MESSAGE } from '@/lib/whitelist'

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect('/signup?error=supabase_disabled')
  }

  // Beta whitelist gate — BEFORE auth.signUp so we don't pollute auth.users
  // with rejected emails. Empty WHITELIST_EMAILS env (or '*') = open signup.
  const emailInput = (formData.get('email') as string) || ''
  if (!isEmailWhitelisted(emailInput)) {
    redirect('/signup?error=' + encodeURIComponent(WHITELIST_REJECT_MESSAGE))
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      options: {
        data: {
          full_name: formData.get('name') as string,
        },
      },
    })

    if (error) {
      redirect('/signup?error=' + encodeURIComponent(error.message))
    }

    // Side effects: create user_profiles row + seed default TG channels.
    // Best-effort — if email-confirmation flow is on, user is not yet authenticated
    // and RLS will reject the insert. /api/profile POST is idempotent and will
    // lazy-create the row on first onboarding save, so we don't fail signup.
    const user = data?.user
    if (user) {
      try {
        await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            full_name: (formData.get('name') as string) || null,
            icp_segment: 'middle',
            skills: [],
            remote_ok: true,
            experience_years: 0,
          })
        // ignore unique-violation / RLS errors; row may already exist or auth not yet active
      } catch {
        /* swallow */
      }
      try {
        await supabase.rpc('tg_seed_default_channels', { p_user_id: user.id })
      } catch {
        /* swallow */
      }
    }
  } catch (e: any) {
    // redirect() throws NEXT_REDIRECT — rethrow to let Next.js handle it
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e
    redirect('/signup?error=server')
  }

  revalidatePath('/', 'layout')
  // New signups always start onboarding — they haven't loaded a CV yet
  redirect('/onboarding')
}
