'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { isEmailWhitelisted, WHITELIST_REJECT_MESSAGE } from '@/lib/whitelist'

// Whitelist intent/promo to prevent open-redirect — never let user-provided
// strings build URLs we redirect to. Only known values pass through.
const VALID_INTENTS = new Set(['pro', 'premium'])
const VALID_PROMOS = new Set(['BETA99'])

function buildOnboardingRedirect(intent?: string | null, promo?: string | null): string {
  const params = new URLSearchParams()
  if (intent && VALID_INTENTS.has(intent)) params.set('intent', intent)
  if (promo && VALID_PROMOS.has(promo)) params.set('promo', promo)
  const qs = params.toString()
  return qs ? `/onboarding?${qs}` : '/onboarding'
}

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect('/signup?error=supabase_disabled')
  }

  // 152-ФЗ defense-in-depth: HTML `required` on the checkbox blocks form
  // submit client-side, but a crafted POST could bypass it. Validate server-side
  // so we don't accidentally create accounts without consent on record.
  const consent = formData.get('consent')
  if (consent !== 'yes') {
    redirect('/signup?error=' + encodeURIComponent(
      'Для регистрации необходимо принять условия Оферты, Политики конфиденциальности и Политики возврата.'
    ))
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

      // 152-ФЗ audit: separate UPDATE so if migration 008 (consent_accepted_at
      // column) isn't applied yet, signup still works — we just don't get the
      // audit timestamp. The column WILL exist on prod after migration applied.
      try {
        await supabase
          .from('user_profiles')
          .update({ consent_accepted_at: new Date().toISOString() })
          .eq('user_id', user.id)
      } catch {
        /* swallow — pre-migration deployments tolerate missing column */
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
  // New signups always start onboarding — they haven't loaded a CV yet.
  // If they came from a pricing CTA (?intent=pro), preserve it so /onboarding
  // can render an "Оформить Pro за ₽99" sticky CTA after CV save.
  const intent = (formData.get('intent') as string) || null
  const promo = (formData.get('promo') as string) || null
  redirect(buildOnboardingRedirect(intent, promo))
}
