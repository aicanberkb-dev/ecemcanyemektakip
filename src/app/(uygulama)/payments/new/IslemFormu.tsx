'use client'

import { useActionState, useState } from 'react'

import { OgrenciSecici, type SeciliOgrenci } from '@/components/OgrenciSecici'
import { bugunISO, para } from '@/lib/format'

import { harcamaEkle, tahsilatEkle, type IslemDurumu } from '../../islem-actions'

export function IslemFormu({ baslangic }: { baslangic: SeciliOgrenci | null }) {
  const [tip, setTip] = useState<'tahsilat' | 'harcama'>('tahsilat')
  const [ogrenci, setOgrenci] = useState<SeciliOgrenci | null>(baslangic)

  const [tahsilatDurum, tahsilatGonder, tahsilatBekliyor] = useActionState(
    tahsilatEkle,
    {} as IslemDurumu,
  )
  const [harcamaDurum, harcamaGonder, harcamaBekliyor] = useActionState(
    harcamaEkle,
    {} as IslemDurumu,
  )

  const durum = tip === 'tahsilat' ? tahsilatDurum : harcamaDurum
  const bekliyor = tip === 'tahsilat' ? tahsilatBekliyor : harcamaBekliyor

  return (
    <div className="kart space-y-5 p-6">
      {/* Tip seçimi */}
      <div className="flex gap-2">
        <TipButonu aktif={tip === 'tahsilat'} onClick={() => setTip('tahsilat')} renk="emerald">
          Tahsilat (para girişi)
        </TipButonu>
        <TipButonu aktif={tip === 'harcama'} onClick={() => setTip('harcama')} renk="slate">
          Harcama (yemek)
        </TipButonu>
      </div>

      <form
        key={tip}
        action={tip === 'tahsilat' ? tahsilatGonder : harcamaGonder}
        className="space-y-4"
      >
        <div>
          <label className="etiket">Öğrenci *</label>
          <OgrenciSecici baslangic={baslangic} onSecim={setOgrenci} />
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
              defaultValue={bugunISO()}
              className="girdi"
            />
            {durum.alanlar?.tarih && <p className="hata">{durum.alanlar.tarih}</p>}
          </div>

          {tip === 'tahsilat' ? (
            <div>
              <label className="etiket" htmlFor="tutar">
                Tutar (₺) *
              </label>
              <input
                id="tutar"
                name="tutar"
                inputMode="decimal"
                placeholder="0,00"
                className="girdi"
                autoFocus
              />
              {durum.alanlar?.tutar && <p className="hata">{durum.alanlar.tutar}</p>}
            </div>
          ) : (
            <div>
              <label className="etiket">Düşülecek tutar</label>
              <div className="girdi bg-slate-50 text-slate-600">
                {!ogrenci
                  ? 'Öğrenci seçin'
                  : ogrenci.abone_tipi === 'aylik'
                    ? '0,00 ₺ — aylıkçı devam kaydı'
                    : para(ogrenci.gunluk_ucret)}
              </div>
              <p className="mt-1 text-xs text-solgun">
                Tutar öğrencinin iskontosundan ve ayarlardan hesaplanır.
              </p>
            </div>
          )}
        </div>

        {tip === 'tahsilat' && (
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
        )}

        {durum.hata && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{durum.hata}</p>
        )}
        {durum.basari && (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {durum.basari}
          </p>
        )}

        <button className="btn-birincil" disabled={bekliyor || !ogrenci}>
          {bekliyor ? 'Kaydediliyor…' : tip === 'tahsilat' ? 'Tahsilatı Kaydet' : 'Yemek Kaydı Ekle'}
        </button>
      </form>
    </div>
  )
}

function TipButonu({
  aktif,
  onClick,
  renk,
  children,
}: {
  aktif: boolean
  onClick: () => void
  renk: 'emerald' | 'slate'
  children: React.ReactNode
}) {
  const aktifSinif =
    renk === 'emerald'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
      : 'border-slate-500 bg-slate-100 text-slate-800'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition ${
        aktif ? aktifSinif : 'border-cizgi bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
