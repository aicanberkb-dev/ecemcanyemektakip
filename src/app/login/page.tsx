import { Zilla_Slab } from 'next/font/google'

import { GirisFormu } from './GirisFormu'

export const metadata = { title: 'Giriş — Yemek Takip' }

const slab = Zilla_Slab({ subsets: ['latin', 'latin-ext'], weight: ['700'], display: 'swap' })

/**
 * Giriş ekranı — koyu sahne: ortada büyük logo, altında giriş kartı.
 * Okul girişten sonra seçildiği için burada okul rengi yok; ortak Ecem Can Gıda
 * kimliği var.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>
}) {
  const { devam } = await searchParams

  return (
    <main
      className="giris-koyu flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #5c1018 0%, #1d0a0c 75%)' }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo */}
        <img
          src="/logo/logo-kirmizi-beyaz.svg"
          alt="Ecem Can Gıda"
          className="w-[min(420px,82vw)] drop-shadow-[0_18px_22px_rgb(0_0_0/0.5)]"
        />
        <span className={`${slab.className} text-base tracking-[0.3em] text-[#f0c9cb]`}>
          ECEM CAN GIDA
        </span>
      </div>

      <div className="kart w-full max-w-sm p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-bold text-[#8e0c12]">Yemek Takip</h1>
        <p className="mb-6 text-sm text-solgun">Devam etmek için giriş yapın.</p>
        <GirisFormu devam={devam ?? '/pos'} />
      </div>
    </main>
  )
}
