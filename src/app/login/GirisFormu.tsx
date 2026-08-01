'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { supabaseBrowser } from '@/lib/supabase/client'

const sema = z.object({
  email: z.email('Geçerli bir e-posta girin.'),
  sifre: z.string().min(1, 'Şifre gerekli.'),
})

type Girdi = z.infer<typeof sema>

export function GirisFormu({ devam }: { devam: string }) {
  const router = useRouter()
  const [hata, setHata] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Girdi>({ resolver: zodResolver(sema) })

  async function gonder(girdi: Girdi) {
    setHata(null)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({
      email: girdi.email,
      password: girdi.sifre,
    })

    if (error) {
      setHata(
        error.message === 'Invalid login credentials'
          ? 'E-posta veya şifre hatalı.'
          : error.message,
      )
      return
    }

    router.replace(devam.startsWith('/') ? devam : '/pos')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(gonder)} className="space-y-4">
      <div>
        <label className="etiket" htmlFor="email">
          E-posta
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          className="girdi"
          {...register('email')}
        />
        {errors.email && <p className="hata">{errors.email.message}</p>}
      </div>

      <div>
        <label className="etiket" htmlFor="sifre">
          Şifre
        </label>
        <input
          id="sifre"
          type="password"
          autoComplete="current-password"
          className="girdi"
          {...register('sifre')}
        />
        {errors.sifre && <p className="hata">{errors.sifre.message}</p>}
      </div>

      {hata && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{hata}</p>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-birincil w-full">
        {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </button>
    </form>
  )
}
