'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { OdemeYontemiSecici } from '@/components/OdemeYontemiSecici'
import { OgrenciSecici, type SeciliOgrenci } from '@/components/OgrenciSecici'
import { bugunISO, para } from '@/lib/format'
import type { OdemeYontemi } from '@/lib/types'

import { tahsilatEkle, type IslemDurumu } from '../../islem-actions'
import { SonTahsilatlar } from './SonTahsilatlar'

/**
 * Yalnızca tahsilat (para girişi) alır. Yemek kaydı bu ekranda yapılmaz:
 * bugünkü öğünler Yemekhane, geçmiş tarihler Toplu Giriş ekranından girilir.
 */
export function IslemFormu({
  okulId,
  baslangic,
}: {
  okulId: string
  baslangic: SeciliOgrenci | null
}) {
  const [ogrenci, setOgrenci] = useState<SeciliOgrenci | null>(baslangic)
  const [yontem, setYontem] = useState<OdemeYontemi | null>(null)
  // Mükerrer kontrolü için tarih ve tutar kontrollü tutulur
  const [tarih, setTarih] = useState(bugunISO())
  const [tutar, setTutar] = useState('')
  const [durum, gonder, bekliyor] = useActionState(tahsilatEkle, {} as IslemDurumu)

  return (
    <div className="kart space-y-5 p-6">
      <form action={gonder} className="space-y-4">
        <div>
          <label className="etiket">Öğrenci *</label>
          <OgrenciSecici okulId={okulId} baslangic={baslangic} onSecim={setOgrenci} />
          {durum.alanlar?.student_id && <p className="hata">{durum.alanlar.student_id}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiket" htmlFor="tarih">
              Tarih *
            </label>
            <input
              id="tarih"
              type="date"
              name="tarih"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="girdi"
            />
            {durum.alanlar?.tarih && <p className="hata">{durum.alanlar.tarih}</p>}
          </div>

          <div>
            <label className="etiket" htmlFor="tutar">
              Alınan Tutar (₺) *
            </label>
            <input
              id="tutar"
              name="tutar"
              inputMode="decimal"
              placeholder="0,00"
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              className="girdi"
            />
            {durum.alanlar?.tutar && <p className="hata">{durum.alanlar.tutar}</p>}
          </div>
        </div>

        <div>
          <label className="etiket">Ödeme Yöntemi *</label>
          <OdemeYontemiSecici onSecim={setYontem} />
          {durum.alanlar?.odeme_yontemi && (
            <p className="hata">{durum.alanlar.odeme_yontemi}</p>
          )}
        </div>

        <div>
          <label className="etiket" htmlFor="aciklama">
            Açıklama
          </label>
          <input
            id="aciklama"
            name="aciklama"
            className="girdi"
            placeholder="ör. Ekim taksiti, elden"
          />
        </div>

        {ogrenci && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-solgun">
            {ogrenci.ad_soyad} — güncel bakiye{' '}
            <strong className={ogrenci.kalan < 0 ? 'text-red-600' : 'text-emerald-700'}>
              {para(ogrenci.kalan)}
            </strong>
          </p>
        )}

        {durum.hata && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{durum.hata}</p>
        )}
        {durum.basari && (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {durum.basari}
          </p>
        )}

        <button className="btn-birincil" disabled={bekliyor || !ogrenci || !yontem}>
          {bekliyor ? 'Kaydediliyor…' : 'Tahsilatı Kaydet'}
        </button>
        {!yontem && ogrenci && (
          <p className="text-xs text-solgun">Kaydetmek için ödeme yöntemini seçin.</p>
        )}
      </form>

      <SonTahsilatlar
        studentId={ogrenci?.student_id ?? null}
        tarih={tarih}
        tutar={tutar}
        yenile={durum.zaman}
      />

      <p className="border-t border-cizgi pt-4 text-sm text-solgun">
        Yemek kaydı bu ekrandan girilmez. Bugünkü öğünler için{' '}
        <Link href="/pos" className="text-vurgu hover:underline">
          Yemekhane
        </Link>
        , geçmiş bir tarih için{' '}
        <Link href="/toplu" className="text-vurgu hover:underline">
          Toplu Giriş
        </Link>{' '}
        ekranını kullanın.
      </p>
    </div>
  )
}
