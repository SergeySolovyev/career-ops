'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect('/login?error=supabase_disabled')
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    })

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message))
    }
  } catch (e: any) {
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e
    redirect('/login?error=server')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect('/login')
  }
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // ignore
  }
  redirect('/login')
}
