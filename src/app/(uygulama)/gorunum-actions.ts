'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { GORUNUM_CEREZI, gorunumCozumle } from '@/lib/gorunum'

/** Orta alan görünümünü değiştirir; seçim bu cihazda saklanır. */
export async function gorunumDegistir(no: string) {
  const cerezler = await cookies()
  cerezler.set(GORUNUM_CEREZI, gorunumCozumle(no), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
