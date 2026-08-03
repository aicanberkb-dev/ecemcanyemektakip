'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import type { Student } from '@/lib/types'

import type { FormDurumu } from './actions'

type Props = {
  eylem: (durum: FormDurumu, formData: FormData) => Promise<FormDurumu>
  ogrenci?: Student
  iptalYolu: string
  /** Yeni kayıtta atanacak numara (önizleme) */
  sonrakiNo?: string
}

export function OgrenciFormu({ eylem, ogrenci, iptalYolu, sonrakiNo }: Props) {
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as FormDurumu)
  const h = durum.alanlar ?? {}

  // Sayıları Türkçe biçimde (virgüllü) göster
  const vir = (n: number | undefined) => String(n ?? 0).replace('.', ',')

  return (
    <form action={gonder} className="kart space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Numarayı sistem verir; elle değiştirilemez ki numara düzeni bozulmasın */}
        <Alan ad="ogrenci_no_gosterim" etiket="Öğrenci No">
          <div className="girdi flex items-center justify-between bg-slate-100 text-slate-600">
            <span className="font-medium tabular-nums">
              {ogrenci?.ogrenci_no ?? sonrakiNo ?? '—'}
            </span>
            <span className="text-xs">otomatik</span>
          </div>
        </Alan>

        <Alan ad="ad_soyad" etiket="Ad Soyad *" hata={h.ad_soyad}>
          <input
            name="ad_soyad"
            defaultValue={ogrenci?.ad_soyad}
            className="girdi"
            required
            autoFocus
          />
        </Alan>

        <Alan ad="sinif" etiket="Sınıf" hata={h.sinif}>
          <input name="sinif" defaultValue={ogrenci?.sinif ?? ''} className="girdi" />
        </Alan>

        <Alan ad="kimlik_no" etiket="Kimlik / Kart No" hata={h.kimlik_no}>
          <input name="kimlik_no" defaultValue={ogrenci?.kimlik_no ?? ''} className="girdi" />
        </Alan>

        <Alan ad="veli_adi" etiket="Veli Adı" hata={h.veli_adi}>
          <input name="veli_adi" defaultValue={ogrenci?.veli_adi ?? ''} className="girdi" />
        </Alan>

        <Alan ad="veli_telefon" etiket="Veli Telefon" hata={h.veli_telefon}>
          <input
            name="veli_telefon"
            defaultValue={ogrenci?.veli_telefon ?? ''}
            className="girdi"
            placeholder="0555 555 55 55"
          />
        </Alan>
      </div>

      <div className="grid gap-4 border-t border-cizgi pt-5 sm:grid-cols-3">
        <Alan ad="abone_tipi" etiket="Abone Tipi" hata={h.abone_tipi}>
          <select
            name="abone_tipi"
            defaultValue={ogrenci?.abone_tipi ?? 'gunluk'}
            className="girdi"
          >
            <option value="gunluk">Günlükçü (yemek başına düşer)</option>
            <option value="aylik">Aylıkçı (taksitten tahsil edilir)</option>
          </select>
        </Alan>

        <Alan ad="aktif" etiket="Durum" hata={h.aktif}>
          <select
            name="aktif"
            defaultValue={String(ogrenci?.aktif ?? true)}
            className="girdi"
          >
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </Alan>

        <Alan ad="devir" etiket="Devir (önceki dönem bakiyesi)" hata={h.devir}>
          <input
            name="devir"
            defaultValue={vir(ogrenci?.devir)}
            className="girdi"
            inputMode="decimal"
          />
        </Alan>

        <Alan ad="iskonto_orani" etiket="İskonto Oranı (%)" hata={h.iskonto_orani}>
          <input
            name="iskonto_orani"
            defaultValue={vir(ogrenci?.iskonto_orani)}
            className="girdi"
            inputMode="decimal"
          />
        </Alan>

        <Alan ad="iskonto_tutar" etiket="İskonto Tutarı (₺)" hata={h.iskonto_tutar}>
          <input
            name="iskonto_tutar"
            defaultValue={vir(ogrenci?.iskonto_tutar)}
            className="girdi"
            inputMode="decimal"
          />
        </Alan>
      </div>

      {durum.hata && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{durum.hata}</p>
      )}

      <div className="flex gap-3 border-t border-cizgi pt-5">
        <button className="btn-birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <Link href={iptalYolu} className="btn-ikincil">
          İptal
        </Link>
      </div>
    </form>
  )
}

function Alan({
  ad,
  etiket,
  hata,
  children,
}: {
  ad: string
  etiket: string
  hata?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="etiket" htmlFor={ad}>
        {etiket}
      </label>
      {children}
      {hata && <p className="hata">{hata}</p>}
    </div>
  )
}
