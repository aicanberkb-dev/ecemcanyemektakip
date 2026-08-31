'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useState } from 'react'

import { useBugun } from '@/components/BugunSaglayici'
import { para, tarih as tarihBicim } from '@/lib/format'

import {
  abonelikAc,
  abonelikKapat,
  iadeIsle,
  type HakedisDurumu,
} from './hakedis-actions'

export type Hakedis = {
  sezon_adi: string
  yillik_ucret: number | string
  ders_gunu: number
  gunluk_tahakkuk: number | string
  gecen_gun: number
  kalan_gun: number
  hakedis: number | string
  tahsilat: number | string
  iade_edilen: number | string
  /** Tahsilat − iade − hakediş: artı ise iade edilebilir, eksi ise borçlu */
  fark: number | string
  donem_bitti: boolean
  donem_bitisi: string | null
}

/**
 * Aylıkçının hakediş hesabı.
 *
 * Veli "çocuğum gelmiyor, param geri" dediğinde rakam pazarlık konusu
 * olmasın: geçen ders günü × günlük tahakkuk kadarını hak ettik, üstü iade.
 * Aylıkçının bakiyesi bu soruya cevap veremiyor — öğün ücreti düşülmediği
 * için "kalan" hep yatırılan paraya eşit çıkıyor.
 */
export function HakedisBolumu({
  studentId,
  hakedis,
}: {
  studentId: string
  hakedis: Hakedis
}) {
  const router = useRouter()
  const [kapatAcik, setKapatAcik] = useState(false)
  const [iadeAcik, setIadeAcik] = useState(false)
  const bugun = useBugun()
  const [bitis, setBitis] = useState(bugun)
  const [sebep, setSebep] = useState('')
  const [calisiyor, setCalisiyor] = useState(false)

  const eylem = iadeIsle.bind(null, studentId)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as HakedisDurumu)

  if (durum.basari && iadeAcik) setIadeAcik(false)

  const fark = Number(hakedis.fark)
  const iadeEdilebilir = fark > 0.005
  const borclu = fark < -0.005

  async function calistir(is: () => Promise<HakedisDurumu>) {
    setCalisiyor(true)
    try {
      const s = await is()
      if (s.hata) alert(s.hata)
      else {
        setKapatAcik(false)
        router.refresh()
      }
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <div className="kart p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Hakediş — {hakedis.sezon_adi}</h2>
        {hakedis.donem_bitti ? (
          <span className="rozet bg-slate-200 text-slate-700">
            abonelik {tarihBicim(hakedis.donem_bitisi)} tarihinde kapandı
          </span>
        ) : (
          <span className="rozet bg-emerald-100 text-emerald-800">abonelik açık</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kutu
          baslik="Günlük tahakkuk"
          deger={para(hakedis.gunluk_tahakkuk)}
          alt={`${para(hakedis.yillik_ucret)} ÷ ${hakedis.ders_gunu} ders günü`}
        />
        <Kutu
          baslik="Bugüne kadar"
          deger={para(hakedis.hakedis)}
          alt={`${hakedis.gecen_gun} ders günü geçti · ${hakedis.kalan_gun} kaldı`}
        />
        <Kutu
          baslik="Tahsil edilen"
          deger={para(Number(hakedis.tahsilat) - Number(hakedis.iade_edilen))}
          alt={
            Number(hakedis.iade_edilen) > 0
              ? `${para(hakedis.tahsilat)} alındı, ${para(hakedis.iade_edilen)} iade edildi`
              : undefined
          }
          renk="text-emerald-700"
        />
        <Kutu
          baslik={iadeEdilebilir ? 'İade edilebilir' : borclu ? 'Alacağımız' : 'Denk'}
          deger={para(Math.abs(fark))}
          renk={iadeEdilebilir ? 'text-amber-700' : borclu ? 'text-red-600' : 'text-solgun'}
        />
      </div>

      <p className="mt-3 text-xs text-solgun">
        Aylıkçı yemeğe gelse de gelmese de günlük tahakkuku işler; veli yıllık ücreti
        ödüyor. Ayrılma durumunda <strong>önce aboneliği kapatın</strong> — tahakkuk o
        tarihte durur — sonra farkı iade edin.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {hakedis.donem_bitti ? (
          <button
            type="button"
            disabled={calisiyor}
            onClick={() => {
              if (!confirm('Abonelik yeniden açılsın mı? Tahakkuk sezon sonuna kadar işler.'))
                return
              calistir(() => abonelikAc(studentId))
            }}
            className="btn-ikincil !py-1.5"
          >
            Aboneliği yeniden aç
          </button>
        ) : (
          !kapatAcik && (
            <button
              type="button"
              onClick={() => setKapatAcik(true)}
              className="btn-ikincil !py-1.5"
            >
              Aboneliği kapat
            </button>
          )
        )}

        {!iadeAcik && (
          <button
            type="button"
            onClick={() => setIadeAcik(true)}
            className="btn-ikincil !py-1.5"
          >
            İade işle
          </button>
        )}
      </div>

      {kapatAcik && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
          <div>
            <label className="etiket text-xs">Kapanış tarihi</label>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
              className="girdi !py-1.5"
            />
          </div>
          <div className="min-w-48 flex-1">
            <label className="etiket text-xs">Sebep</label>
            <input
              value={sebep}
              onChange={(e) => setSebep(e.target.value)}
              placeholder="ör. Okuldan ayrıldı"
              className="girdi !py-1.5"
            />
          </div>
          <button
            type="button"
            disabled={calisiyor}
            onClick={() => calistir(() => abonelikKapat(studentId, bitis, sebep))}
            className="btn-birincil !py-1.5"
          >
            Kapat
          </button>
          <button
            type="button"
            onClick={() => setKapatAcik(false)}
            className="btn-ikincil !py-1.5"
          >
            Vazgeç
          </button>
          <p className="w-full text-xs text-solgun">
            Bu tarihten sonra ciroya tahakkuk yazılmaz. Geçmiş günler yerinde kalır.
          </p>
        </div>
      )}

      {iadeAcik && (
        <form action={gonder} className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
          <div>
            <label className="etiket text-xs">İade tutarı (₺)</label>
            <input
              name="tutar"
              inputMode="decimal"
              defaultValue={iadeEdilebilir ? String(fark.toFixed(2)).replace('.', ',') : ''}
              className="girdi !py-1.5 w-36"
            />
          </div>
          <div>
            <label className="etiket text-xs">Tarih</label>
            <input type="date" name="tarih" defaultValue={bugun} className="girdi !py-1.5" />
          </div>
          <div className="min-w-40 flex-1">
            <label className="etiket text-xs">Açıklama</label>
            <input
              name="aciklama"
              placeholder="Abonelik iadesi"
              className="girdi !py-1.5"
            />
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            İadeyi kaydet
          </button>
          <button
            type="button"
            onClick={() => setIadeAcik(false)}
            className="btn-ikincil !py-1.5"
          >
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
          <p className="w-full text-xs text-solgun">
            Önerilen tutar hakediş farkıdır; istediğiniz rakamı yazabilirsiniz. Fazlası
            verilen tavizdir ve İadeler raporunda görünür.
          </p>
        </form>
      )}
    </div>
  )
}

function Kutu({
  baslik,
  deger,
  alt,
  renk,
}: {
  baslik: string
  deger: string
  alt?: string
  renk?: string
}) {
  return (
    <div className="rounded-md border border-cizgi p-3">
      <p className="text-xs font-medium tracking-wide text-solgun uppercase">{baslik}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${renk ?? ''}`}>{deger}</p>
      {alt && <p className="mt-0.5 text-xs text-solgun">{alt}</p>}
    </div>
  )
}
