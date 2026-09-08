'use client'

import { useState } from 'react'

import {
  ANASINIFI,
  ANASINIFI_SUBELERI,
  SINIFLAR,
  SUBELER,
  sinifCozumle,
} from '@/lib/sinif'
import { OGRENCI_TIPI_ADLARI, type OgrenciTipi } from '@/lib/types'

/** Anasınıfı öğrencisi ya düz anasınıfı ya da etütlüdür; başkası olamaz. */
const ANASINIFI_TIPLERI: OgrenciTipi[] = ['anasinifi', 'anasinifi_etut']
const SERBEST_TIPLER: OgrenciTipi[] = ['standart', 'anasinifi', 'anasinifi_etut']

/**
 * Sınıf/şube ve öğrenci tipi seçimi — ikisi birbirine bağlı olduğu için tek
 * bileşen.
 *
 * Sınıf elle yazıldığında "1-a", "1/A", "1 A" gibi biçimler oluşuyor ve sınıf
 * bazlı listeler bölünüyordu; açılır listeler her zaman "1-A" ya da
 * "Anasınıfı-C" üretir.
 *
 * Öğrenci tipi ücretlendirme planını belirliyor, bu yüzden sınıfla çelişmemeli:
 * numaralı bir sınıfta tip zorunlu olarak standart, anasınıfında ise yalnızca
 * anasınıfı veya anasınıfı + etüt olabilir. Seçim bırakılırsa öğrenci yanlış
 * taksit planına düşüyor ve hata ancak ay sonunda fark ediliyor.
 */
export function SinifTipSecici({
  baslangicSinif,
  baslangicTip,
  tipHatasi,
}: {
  baslangicSinif?: string | null
  baslangicTip?: OgrenciTipi | null
  tipHatasi?: string
}) {
  const ilk = sinifCozumle(baslangicSinif)
  const [sinif, setSinif] = useState(ilk.sinif)
  const [sube, setSube] = useState(ilk.sube)
  // birinci_sinif tipi kaldırıldı; eski kayıtlar standart olarak açılır.
  const [tip, setTip] = useState<string>(
    baslangicTip && baslangicTip !== 'birinci_sinif' ? baslangicTip : '',
  )

  const anasinifi = sinif === ANASINIFI
  const numarali = sinif !== '' && !anasinifi

  const subeler = anasinifi ? ANASINIFI_SUBELERI : SUBELER.map((s) => ({ kod: s, ad: s }))
  const sinifDegeri = sinif && sube ? `${sinif}-${sube}` : ''
  // Numaralı sınıflarda tip sorulmaz: hepsi standart tarifeye tabi.
  const tipDegeri = numarali ? 'standart' : tip
  const tipSecenekleri = anasinifi ? ANASINIFI_TIPLERI : SERBEST_TIPLER

  function sinifDegistir(yeni: string) {
    setSinif(yeni)

    if (yeni === ANASINIFI) {
      // Anasınıfında D-H şubesi yok; seçili kalırsa geçersiz değer üretirdi.
      if (!ANASINIFI_SUBELERI.some((s) => s.kod === sube)) setSube('')
      if (!ANASINIFI_TIPLERI.includes(tip as OgrenciTipi)) setTip('')
    } else if (ANASINIFI_TIPLERI.includes(tip as OgrenciTipi)) {
      setTip('')
    }
  }

  return (
    <>
      <input type="hidden" name="sinif" value={sinifDegeri} />

      <div>
        <label className="etiket">Sınıf / Şube</label>
        <div className="flex gap-2">
          <select
            value={sinif}
            onChange={(e) => sinifDegistir(e.target.value)}
            className="girdi"
            aria-label="Sınıf"
          >
            <option value="">Sınıf</option>
            <option value={ANASINIFI}>{ANASINIFI}</option>
            {SINIFLAR.map((s) => (
              <option key={s} value={s}>
                {s}. sınıf
              </option>
            ))}
          </select>
          <select
            value={sube}
            onChange={(e) => setSube(e.target.value)}
            className="girdi"
            aria-label="Şube"
          >
            <option value="">Şube</option>
            {subeler.map((s) => (
              <option key={s.kod} value={s.kod}>
                {s.ad}
              </option>
            ))}
          </select>
        </div>
        {sinifDegeri && (
          <p className="mt-1 text-xs text-solgun">Kaydedilecek: {sinifDegeri}</p>
        )}
      </div>

      <div>
        <label className="etiket">Öğrenci Tipi *</label>
        {numarali ? (
          <>
            <input type="hidden" name="ogrenci_tipi" value="standart" />
            <div className="girdi flex items-center justify-between bg-slate-100 text-slate-600">
              <span className="font-medium">Standart</span>
              <span className="text-xs">{sinif}. sınıf → standart plan</span>
            </div>
          </>
        ) : (
          <select
            name="ogrenci_tipi"
            value={tipDegeri}
            onChange={(e) => setTip(e.target.value)}
            className="girdi"
            required
          >
            <option value="">Seçiniz</option>
            {tipSecenekleri.map((t) => (
              <option key={t} value={t}>
                {OGRENCI_TIPI_ADLARI[t]}
              </option>
            ))}
          </select>
        )}
        {anasinifi && (
          <p className="mt-1 text-xs text-solgun">
            Etüt sonradan başlıyorsa şimdi <strong>Anasınıfı</strong> seçin; etüde
            kalınca buradan <strong>Anasınıfı + Etüt</strong>&apos;e çevirin.
          </p>
        )}
        {tipHatasi && <p className="hata">{tipHatasi}</p>}
      </div>
    </>
  )
}
