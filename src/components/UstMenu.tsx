'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { OkulSecici } from '@/components/OkulSecici'
import type { Okul } from '@/lib/types'

const BAGLANTILAR = [
  { yol: '/pos', ad: 'Yemekhane' },
  { yol: '/dashboard', ad: 'Özet' },
  { yol: '/students', ad: 'Öğrenciler' },
  { yol: '/payments/new', ad: 'Tahsilat' },
  { yol: '/reports', ad: 'Raporlar' },
  { yol: '/admin/settings', ad: 'Ayarlar' },
]

const RAPOR_ALT = [
  { yol: '/reports', ad: 'Gelen–Giden–Tahsil' },
  { yol: '/reports/gun-sonu', ad: 'Gün Sonu' },
  { yol: '/reports/nakit', ad: 'Nakit' },
  { yol: '/reports/devam', ad: 'Devam Çizelgesi' },
  { yol: '/reports/tahsilat', ad: 'Tahsilat Geçmişi' },
  { yol: '/reports/taksit', ad: 'Taksit Takibi' },
]

const AYAR_ALT = [
  { yol: '/admin/settings', ad: 'Ücretler & Taksit Planı' },
  { yol: '/admin/users', ad: 'Kullanıcılar' },
  { yol: '/admin/audit-log', ad: 'İşlem Geçmişi' },
]

export function UstMenu({
  kullanici,
  okullar,
  aktifOkulId,
}: {
  kullanici: string
  okullar: Okul[]
  aktifOkulId: string
}) {
  const yol = usePathname()
  const [acikMenu, setAcikMenu] = useState(false)

  const aktifMi = (hedef: string) =>
    hedef === '/reports'
      ? yol.startsWith('/reports')
      : hedef === '/admin/settings'
        ? yol.startsWith('/admin')
        : yol === hedef || yol.startsWith(`${hedef}/`)

  const altMenu = yol.startsWith('/reports')
    ? RAPOR_ALT
    : yol.startsWith('/admin')
      ? AYAR_ALT
      : null

  return (
    <header className="border-b border-cizgi bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/pos" className="text-lg font-bold tracking-tight text-vurgu">
          Yemek Takip
        </Link>

        <OkulSecici okullar={okullar} aktifId={aktifOkulId} />

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {BAGLANTILAR.map((b) => (
            <Link
              key={b.yol}
              href={b.yol}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                aktifMi(b.yol)
                  ? 'bg-blue-50 text-vurgu'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-metin'
              }`}
            >
              {b.ad}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <span className="hidden text-sm text-solgun sm:inline">{kullanici}</span>
          <form action="/auth/cikis" method="post">
            <button className="btn-ikincil !px-3 !py-1.5 text-xs">Çıkış</button>
          </form>
          <button
            type="button"
            onClick={() => setAcikMenu((a) => !a)}
            className="btn-ikincil !px-3 !py-1.5 md:hidden"
            aria-label="Menü"
          >
            ☰
          </button>
        </div>
      </div>

      {acikMenu && (
        <nav className="flex flex-col border-t border-cizgi px-4 py-2 md:hidden">
          {[...BAGLANTILAR, ...RAPOR_ALT.slice(1), ...AYAR_ALT.slice(1)].map((b) => (
            <Link
              key={b.yol}
              href={b.yol}
              onClick={() => setAcikMenu(false)}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {b.ad}
            </Link>
          ))}
        </nav>
      )}

      {altMenu && (
        <div className="border-t border-cizgi bg-slate-50">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2">
            {altMenu.map((b) => (
              <Link
                key={b.yol}
                href={b.yol}
                className={`rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition ${
                  yol === b.yol
                    ? 'bg-white text-vurgu shadow-sm'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                {b.ad}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
