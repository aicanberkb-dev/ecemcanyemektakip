'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { tarih as tarihBicim } from '@/lib/format'
import { aramaNormalle } from '@/lib/arama'

import { ADAY_ETIKETI, type AdayOgrenci } from './aday'
import { kayitsizAktar } from './actions'

export type AktarilacakAd = {
  ad: string
  sinif: string | null
  /** Aktarılmamış gelişlerin satır id'leri */
  ids: string[]
  tarihler: string[]
  adaylar: AdayOgrenci[]
}

type Ogrenci = { id: string; ad_soyad: string; sinif: string | null }

/**
 * Kayıtsız gelen çocuğun kaydı açıldıktan sonra geçmiş günlerini aktarır.
 *
 * Ad yemekhanede elle yazıldığı için önce benzeyen öğrenciler öneriliyor;
 * tutmazsa listede arama yapılıyor. Seçim onaylanınca o günlerin yemek
 * kayıtları öğrencinin hesabına düşüyor.
 */
export function AktarKutusu({
  bekleyenler,
  ogrenciler,
}: {
  bekleyenler: AktarilacakAd[]
  ogrenciler: Ogrenci[]
}) {
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)

  if (bekleyenler.length === 0) return null

  return (
    <div className="kart p-4">
      <h2 className="font-semibold">Kayda Aktar</h2>
      <p className="mt-1 text-sm text-solgun">
        Kaydını açtığın çocuğun kayıtsız geldiği günleri hesabına işler. Öğünler o günün
        tarifesinden fiyatlanır; o gün zaten yemek kaydı varsa atlanır.
      </p>

      {mesaj && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            mesaj.tip === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      <div className="mt-3 space-y-2">
        {bekleyenler.map((b) => (
          <AdSatiri key={b.ad} bekleyen={b} ogrenciler={ogrenciler} bildir={setMesaj} />
        ))}
      </div>
    </div>
  )
}

function AdSatiri({
  bekleyen,
  ogrenciler,
  bildir,
}: {
  bekleyen: AktarilacakAd
  ogrenciler: Ogrenci[]
  bildir: (m: { tip: 'ok' | 'hata'; metin: string }) => void
}) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [bekliyor, baslat] = useTransition()

  // Öneriler tutmazsa bütün listede ara; ad yanlış yazılmış olabilir
  const aramaSonucu = useMemo(() => {
    const q = aramaNormalle(arama)
    if (q.length < 2) return []
    return ogrenciler
      .filter((o) => aramaNormalle(o.ad_soyad).includes(q))
      .slice(0, 8)
  }, [arama, ogrenciler])

  function aktar(ogrenci: Ogrenci) {
    if (
      !confirm(
        `${bekleyen.ad} adına yazılmış ${bekleyen.ids.length} gün, ` +
          `${ogrenci.ad_soyad} öğrencisinin kaydına aktarılacak. Onaylıyor musun?`,
      )
    ) {
      return
    }

    baslat(async () => {
      const sonuc = await kayitsizAktar(ogrenci.id, bekleyen.ids)
      if (sonuc.hata) bildir({ tip: 'hata', metin: sonuc.hata })
      else bildir({ tip: 'ok', metin: `${ogrenci.ad_soyad}: ${sonuc.basari}` })
      setAcik(false)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-cizgi">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-medium">{bekleyen.ad}</span>
        {bekleyen.sinif && <span className="rozet bg-slate-100 text-slate-700">{bekleyen.sinif}</span>}
        <span className="text-xs text-solgun">
          {bekleyen.ids.length} gün · {bekleyen.tarihler.map((t) => tarihBicim(t)).join(' · ')}
        </span>
        <button
          type="button"
          onClick={() => setAcik(!acik)}
          className="ml-auto rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-900"
        >
          {acik ? 'Kapat' : 'Kayda aktar'}
        </button>
      </div>

      {acik && (
        <div className="space-y-2 border-t border-cizgi p-3">
          {bekleyen.adaylar.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-slate-700">Önerilen öğrenciler</p>
              <ul className="space-y-1">
                {bekleyen.adaylar.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{a.ad_soyad}</span>
                    {a.sinif && <span className="text-xs text-solgun">{a.sinif}</span>}
                    <span
                      className={`rozet ${
                        a.tur === 'birebir'
                          ? 'bg-emerald-100 text-emerald-800'
                          : a.tur === 'benzer'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ADAY_ETIKETI[a.tur]}
                    </span>
                    <button
                      type="button"
                      disabled={bekliyor}
                      onClick={() => aktar(a)}
                      className="ml-auto text-xs font-semibold text-vurgu hover:underline disabled:opacity-40"
                    >
                      Bunu seç
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-solgun">
              Bu ada benzeyen öğrenci bulunamadı. Aşağıdan arayabilirsin.
            </p>
          )}

          <div className="border-t border-cizgi pt-2">
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Öğrenci ara…"
              className="girdi w-full !py-1 text-sm"
            />
            {aramaSonucu.length > 0 && (
              <ul className="mt-1 space-y-1">
                {aramaSonucu.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{o.ad_soyad}</span>
                    {o.sinif && <span className="text-xs text-solgun">{o.sinif}</span>}
                    <button
                      type="button"
                      disabled={bekliyor}
                      onClick={() => aktar(o)}
                      className="ml-auto text-xs font-semibold text-vurgu hover:underline disabled:opacity-40"
                    >
                      Bunu seç
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
