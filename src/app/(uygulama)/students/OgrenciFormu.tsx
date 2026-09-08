'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { SinifTipSecici } from '@/components/SinifSecici'
import type { Student } from '@/lib/types'

import type { BenzerOgrenci, FormDurumu } from './actions'

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
  const benzerler = durum.benzerler ?? []

  // Sayıları Türkçe biçimde (virgüllü) göster
  const vir = (n: number | undefined) => String(n ?? 0).replace('.', ',')

  /**
   * React, form eylemi bittiğinde kontrolsüz alanları temizliyor. Hata ya da
   * mükerrer uyarısı döndüğünde kullanıcının yazdıkları kaybolmasın diye
   * alanlar sunucudan geri gelen değerlerle kuruluyor; `key` değişince form
   * yeniden kurulur ve yeni varsayılanlar uygulanır.
   */
  const g = durum.girilen
  const ilk = (alan: string, varsayilan: string) => g?.[alan] ?? varsayilan
  const metin = (deger: string | null | undefined) => deger ?? ''

  return (
    <form key={durum.deneme ?? 0} action={gonder} className="kart space-y-5 p-6">
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
            defaultValue={ilk('ad_soyad', metin(ogrenci?.ad_soyad))}
            className="girdi"
            required
            autoFocus
          />
        </Alan>

        {/* Sınıf ve öğrenci tipi birbirini belirliyor; tek bileşen */}
        <SinifTipSecici
          baslangicSinif={g?.sinif ?? ogrenci?.sinif}
          baslangicTip={(g?.ogrenci_tipi as Student['ogrenci_tipi']) ?? ogrenci?.ogrenci_tipi}
          tipHatasi={h.ogrenci_tipi}
        />
      </div>

      {/* Veli bilgileri satır satır: her velinin adı, telefonu ve T.C. no'su
          yan yana dursun ki kaydı alan kişi bir kişiyi tek seferde girsin.
          Dar ekranda alt alta iner. */}
      <div className="space-y-3 border-t border-cizgi pt-5">
        <p className="text-sm font-semibold">Veli Bilgileri</p>

        <VeliSatiri
          baslik="1. Veli"
          adAlani="veli_adi"
          telefonAlani="veli_telefon"
          tcAlani="veli_tc"
          ad={ilk('veli_adi', metin(ogrenci?.veli_adi))}
          telefon={ilk('veli_telefon', metin(ogrenci?.veli_telefon))}
          tc={ilk('veli_tc', metin(ogrenci?.veli_tc))}
          hatalar={h}
        />

        <VeliSatiri
          baslik="2. Veli"
          adAlani="veli2_adi"
          telefonAlani="veli2_telefon"
          tcAlani="veli2_tc"
          ad={ilk('veli2_adi', metin(ogrenci?.veli2_adi))}
          telefon={ilk('veli2_telefon', metin(ogrenci?.veli2_telefon))}
          tc={ilk('veli2_tc', metin(ogrenci?.veli2_tc))}
          adIpucu="Banka havalesi yapan diğer kişi"
          hatalar={h}
        />

        <p className="text-xs text-solgun">
          Veli adlarını <strong>banka ekstresinde göründüğü gibi</strong> yazın. Ödemeyi
          anne de baba da yapabildiği için iki satır var; ekstre aktarımı ödemeyi bu
          adlara bakarak öğrenciyle eşleştirir. T.C. kimlik numarası fatura kesilirken
          gerekiyor.
        </p>
      </div>

      <div className="grid gap-4 border-t border-cizgi pt-5 sm:grid-cols-3">
        {/* Varsayılan yok: seçilmeden kaydedilirse öğrenci yanlış tarifeye
            düşer ve hatayı ancak ay sonunda fark ederiz. */}
        <Alan ad="abone_tipi" etiket="Abone Tipi *" hata={h.abone_tipi}>
          <select
            name="abone_tipi"
            defaultValue={ilk('abone_tipi', ogrenci?.abone_tipi ?? '')}
            className="girdi"
            required
          >
            <option value="">Seçiniz</option>
            <option value="gunluk">Günlükçü (yemek başına düşer)</option>
            <option value="aylik">Aylıkçı (taksitten tahsil edilir)</option>
          </select>
        </Alan>

        <Alan ad="aktif" etiket="Durum" hata={h.aktif}>
          <select
            name="aktif"
            defaultValue={ilk('aktif', String(ogrenci?.aktif ?? true))}
            className="girdi"
          >
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </Alan>

        <Alan ad="devir" etiket="Devir (önceki dönem bakiyesi)" hata={h.devir}>
          <input
            name="devir"
            defaultValue={ilk('devir', vir(ogrenci?.devir))}
            className="girdi"
            inputMode="decimal"
          />
        </Alan>

        <Alan ad="iskonto_orani" etiket="İskonto Oranı (%)" hata={h.iskonto_orani}>
          <input
            name="iskonto_orani"
            defaultValue={ilk('iskonto_orani', vir(ogrenci?.iskonto_orani))}
            className="girdi"
            inputMode="decimal"
          />
        </Alan>

        <Alan ad="iskonto_tutar" etiket="İskonto Tutarı (₺)" hata={h.iskonto_tutar}>
          <input
            name="iskonto_tutar"
            defaultValue={ilk('iskonto_tutar', vir(ogrenci?.iskonto_tutar))}
            className="girdi"
            inputMode="decimal"
          />
        </Alan>
      </div>

      {benzerler.length > 0 && <MukerrerUyarisi benzerler={benzerler} />}

      {durum.hata && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{durum.hata}</p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-cizgi pt-5">
        <button className="btn-birincil" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {benzerler.length > 0 && (
          <button
            name="benzerlik_onayi"
            value="1"
            className="btn-ikincil border-amber-400 text-amber-800"
            disabled={bekliyor}
          >
            Farklı öğrenci, yine de kaydet
          </button>
        )}
        <Link href={iptalYolu} className="btn-ikincil">
          İptal
        </Link>
      </div>
    </form>
  )
}

/**
 * Mükerrer kayıt uyarısı.
 *
 * Engellemiyoruz: gerçekten aynı adlı iki öğrenci olabilir. Ama kaydı alan
 * kişi listeyi görmeden devam edemiyor; kayıtlara bağlantı veriliyor ki
 * "bu zaten var mı" sorusu tek tıkla cevaplansın.
 */
function MukerrerUyarisi({ benzerler }: { benzerler: BenzerOgrenci[] }) {
  const ayni = benzerler.filter((b) => b.benzerlik === 'ayni').length

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">
        {ayni > 0
          ? 'Bu adla kayıtlı öğrenci zaten var.'
          : 'Bu ada çok benzeyen bir kayıt var — yazım hatası olabilir.'}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {benzerler.map((b) => (
          <li key={b.id}>
            <Link
              href={`/students/${b.id}`}
              target="_blank"
              className="text-vurgu hover:underline"
            >
              {b.ad_soyad}
            </Link>
            <span className="text-solgun">
              {' '}
              — no {b.ogrenci_no}
              {b.sinif ? `, ${b.sinif}` : ''}
              {b.benzerlik === 'benzer' && ' (benzer yazım)'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800">
        Aynı öğrenciyse mevcut kaydı düzenleyin. Gerçekten başka bir öğrenciyse
        aşağıdaki <strong>Farklı öğrenci, yine de kaydet</strong> düğmesini kullanın.
      </p>
    </div>
  )
}

function VeliSatiri({
  baslik,
  adAlani,
  telefonAlani,
  tcAlani,
  ad,
  telefon,
  tc,
  adIpucu,
  hatalar,
}: {
  baslik: string
  adAlani: string
  telefonAlani: string
  tcAlani: string
  ad?: string | null
  telefon?: string | null
  tc?: string | null
  adIpucu?: string
  hatalar: Record<string, string>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
      <Alan ad={adAlani} etiket={`${baslik} Adı Soyadı`} hata={hatalar[adAlani]}>
        <input
          name={adAlani}
          defaultValue={ad ?? ''}
          className="girdi"
          placeholder={adIpucu}
        />
      </Alan>

      <Alan ad={telefonAlani} etiket="Telefon" hata={hatalar[telefonAlani]}>
        <input
          name={telefonAlani}
          defaultValue={telefon ?? ''}
          className="girdi"
          placeholder="0555 555 55 55"
        />
      </Alan>

      <Alan ad={tcAlani} etiket="T.C. Kimlik No (fatura)" hata={hatalar[tcAlani]}>
        <input
          name={tcAlani}
          defaultValue={tc ?? ''}
          className="girdi tabular-nums"
          inputMode="numeric"
          maxLength={11}
          placeholder="11 hane"
        />
      </Alan>
    </div>
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
