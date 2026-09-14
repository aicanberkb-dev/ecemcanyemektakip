'use client'

import { createBrowserClient } from '@supabase/ssr'

import { dayanikliFetch } from './dayanikli-fetch'

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Ara ara düşen okuma isteklerini tekrar dener (bkz. dayanikli-fetch)
    { global: { fetch: dayanikliFetch } },
  )
}
