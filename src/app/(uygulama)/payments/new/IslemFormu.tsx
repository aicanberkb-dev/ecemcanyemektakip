'use client'

import Link from 'next/link'
import { useActionState, useEffect, useMemo, useState } from 'react'

import { OdemeYontemiSecici } from '@/components/OdemeYontemiSecici'
import { OgrenciSecici, type SeciliOgrenci } from '@/components/OgrenciSecici'
import { bugunISO, para, tarih as tarihBicim } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { OdemeYontemi, Transaction } from '@/lib/types'

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
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [ogrenci, setOgrenci] = useState<SeciliOgrenci | null>(baslangic)
  const [yontem, setYontem] = useState<OdemeYontemi | null>(null)
  // Mükerrer kontrolü için tarih ve tutar kontrollü tutulur
  const [tarih, setTarih] = useState(bugunISO())
  const [tutar, setTutar] = useState('')
  const [durum, gonder, bekliyor] = useActionState(tahsilatEkle, {} as IslemDurumu)

  // Geçmiş tahsilatlar burada tutuluyor: hem alttaki listeyi besliyor hem de
  // kaydetmeden önce "aynı güne ödeme var mı" kontrolünü mümkün kılıyor.
  const [gecmis, setGecmis] = useState<{ studentId: string | null; kayitlar: Transaction[] }>({
    studentId: null,
    kayitlar: [],
  })

  const studentId = ogrenci?.student_id ?? null

  useEffect(() => {
    if (!studentId) return

    let iptal = false
    supabase
      .from('transactions')
      .select('*')
      .eq('student_id', studentId)
      .eq('tip', 'tahsilat')
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!iptal) setGecmis({ studentId, kayitlar: (data ?? []) as Transaction[] })
      })

    return () => {
      iptal = true
    }
  }, [studentId, supabase, durum.zaman])

  // Kayıttan sonra bakiye sunucudan geldiği gibi yazılır; öğrenci seçili kalır.
  const [islenenZaman, setIslenenZaman] = useState<number | undefined>(undefined)
  if (durum.zaman && durum.zaman !== islenenZaman) {
    setIslenenZaman(durum.zaman)
    if (durum.yeniBakiye !== undefined && ogrenci) {
      setOgrenci({ ...ogrenci, kalan: durum.yeniBakiye })
    }
    setTutar('')
  }

  const kayitlar = gecmis.studentId === studentId ? gecmis.kayitlar : []
  const ayniGun = kayitlar.filter((k) => k.tarih === tarih)

  /**
   * Aynı güne zaten ödeme varsa onay ister.
   *
   * Aynı gün ikinci bir ödeme almak mümkün, o yüzden hata değil uyarı: en sık
   * karşılaşılan durum tarihi değiştirmeyi unutmak.
   */
  function gondermedenOnce(e: React.FormEvent<HTMLFormElement>) {
    if (ayniGun.length === 0) return
    const toplam = ayniGun.reduce((t, k) => t + Number(k.tutar), 0)
    const onay = confirm(
      `${ogrenci?.ad_soyad ?? 'Bu öğrenci'} için ${tarihBicim(tarih)} tarihine zaten ` +
        `${ayniGun.length} ödeme girilmiş (toplam ${para(toplam)}).\n\n` +
        'Tarihi değiştirmeyi unutmuş olabilirsiniz.\nYine de kaydedilsin mi?',
    )
    if (!onay) e.preventDefault()
  }

  return (
    <div className="kart space-y-5 p-6">
      <form action={gonder} onSubmit={gondermedenOnce} className="space-y-4">
        <div>
          <label className="etiket">Öğrenci *</label>
          <OgrenciSecici
            okulId={okulId}
            baslangic={baslangic}
            bakiye={ogrenci?.kalan}
            onSecim={setOgrenci}
          />
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
              className={`girdi ${ayniGun.length > 0 ? 'border-amber-400' : ''}`}
            />
            {durum.alanlar?.tarih && <p className="hata">{durum.alanlar.tarih}</p>}
            {ayniGun.length > 0 && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Bu tarihe {ayniGun.length} ödeme girilmiş
              </p>
            )}
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

        {/* Bakiye yalnızca öğrenci kutusunda gösteriliyor: aynı sayıyı iki
            yerde tutmak, biri güncellenip diğeri kalınca kafa karıştırıyordu. */}

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
        studentId={studentId}
        tarih={tarih}
        tutar={tutar}
        kayitlar={kayitlar}
        yukleniyor={!!studentId && gecmis.studentId !== studentId}
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
