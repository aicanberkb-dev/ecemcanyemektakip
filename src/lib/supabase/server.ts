import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { dayanikliFetch } from './dayanikli-fetch'

export async function supabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Ara ara düşen okuma isteklerini tekrar dener (bkz. dayanikli-fetch)
      global: { fetch: dayanikliFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server component içinden cookie yazılamaz; oturum yenilemeyi proxy yapar.
          }
        },
      },
    },
  )
}
