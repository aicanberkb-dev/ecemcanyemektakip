'use client'

import Link from 'next/link'
import { useActionState, useState, useTransition } from 'react'

import { para } from '@/lib/format'

import { kardesCikar, kardesEkle, type KardesDurumu } from '../kardes-actions'

export type KardesKaydi = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kalan: number
}

export function KardesBolumu({
  studentId,
  kardesler,
  adaylar,
}: {
  studentId: string
  kardesler: KardesKaydi[]
  /** Aynı okuldaki diğer öğrenciler (kendisi ve mevcut kardeşleri hariç) */
  adaylar: KardesKaydi[]
}) {
  const [acik, setAcik] = useState(false)
  const eylem = kardesEkle.bind(null, studentId)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as KardesDurumu)
  const [cikariliyor, basla] = useTransition()

  if (durum.basari && acik) setAcik(false)

  return (
    <div className="kart p-4">
      <h2 className="mb-3 font-semibold">Kardeşler</h2>

      {kardesler.length === 0 ? (
        <p className="text-sm text-solgun">
          Tanımlı kardeş yok. Ekstre aktarımında tek havaleyi kardeşler arasında
          bölüştürebilmek için buradan bağlayın.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {kardesler.map((k) => (
            <li key={k.student_id} className="flex items-center justify-between gap-3">
              <div>
                <Link
                  href={`/students/${k.student_id}`}
                  className="font-medium text-vurgu hover:underline"
                >
                  {k.ad_soyad}
                </Link>
                <span className="ml-2 text-xs text-solgun">
                  {[k.ogrenci_no, k.sinif].filter(Boolean).join(' · ')}
                </span>
              </div>
              <span
                className={`tabular-nums ${k.kalan < 0 ? 'text-red-600' : 'text-solgun'}`}
              >
                {para(k.kalan)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-cizgi pt-3">
        {acik ? (
          <form action={gonder} className="space-y-2">
            <select name="kardes_id" className="girdi !py-1.5" required defaultValue="">
              <option value="" disabled>
                Kardeşi seçin…
              </option>
              {adaylar.map((a) => (
                <option key={a.student_id} value={a.student_id}>
                  {a.ogrenci_no} · {a.ad_soyad}
                  {a.sinif ? ` (${a.sinif})` : ''}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="btn-birincil !py-1.5" disabled={bekliyor}>
                {bekliyor ? 'Bağlanıyor…' : 'Bağla'}
              </button>
              <button
                type="button"
                onClick={() => setAcik(false)}
                className="btn-ikincil !py-1.5"
              >
                Vazgeç
              </button>
            </div>
            {durum.hata && <p className="hata">{durum.hata}</p>}
          </form>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAcik(true)}
              className="text-sm text-vurgu hover:underline"
              disabled={adaylar.length === 0}
            >
              + Kardeş bağla
            </button>
            {kardesler.length > 0 && (
              <button
                type="button"
                disabled={cikariliyor}
                onClick={() => {
                  if (!confirm('Bu öğrenci kardeş grubundan çıkarılsın mı?')) return
                  basla(async () => {
                    await kardesCikar(studentId)
                  })
                }}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {cikariliyor ? 'Çıkarılıyor…' : 'Gruptan çıkar'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
