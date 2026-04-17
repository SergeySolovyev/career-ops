'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function signUp(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect('/signup?error=supabase_disabled')
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
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
  } catch (e: any) {
    // redirect() throws NEXT_REDIRECT — rethrow to let Next.js handle it
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e
    redirect('/signup?error=server')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
