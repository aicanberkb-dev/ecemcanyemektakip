'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useMemo, useState } from 'react'

import { aramaEslesir } from '@/lib/arama'
import { bugunISO, para, tarih as tarihBicim } from '@/lib/format'

import {
  senetEkle,
  senetGuncelle,
  senetOdemeDegistir,
  senetSil,
  type FinansDurumu,
} from './actions'

export type Senet = {
  id: string
  vade_tarihi: string
  kime: string
  tutar: number | string
  banka: string | null
  senet_no: string | null
  odeme_tarihi: string | null
  aciklama: string | null
}

/** Bugünden kaç gün sonra/önce olduğunu verir. */
function gunFarki(iso: string, bugun: string): number {
  const a = new Date(`${iso}T00:00:00`).getTime()
  const b = new Date(`${bugun}T00:00:00`).getTime()
  return Math.round((a - b) / 86400000)
}

/**
 * Tekel senetleri.
 *
 * Excel'de ödenen satırlar yeşile boyanıyordu; burada ödeme tarihi girilince
 * aynı işi yapıyor. Asıl mesele vadesi geçeni kaçırmamak, o yüzden liste
 * vadeye göre sıralı ve gecikenler en üstte ayrıca özetleniyor.
 */
export function SenetEkrani({ senetler }: { senetler: Senet[] }) {
  const bugun = bugunISO()
  const [arama, setArama] = useState('')
  const [acik, setAcik] = useState(false)
  const [gizleOdenen, setGizleOdenen] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(senetEkle, {} as FinansDurumu)

  if (durum.basari && acik) setAcik(false)

  const gosterilen = useMemo(
    () =>
      senetler.filter((s) => {
        if (gizleOdenen && s.odeme_tarihi) return false
        return aramaEslesir(`${s.kime} ${s.banka ?? ''} ${s.senet_no ?? ''}`, arama)
      }),
    [senetler, arama, gizleOdenen],
  )

  const bekleyen = senetler.filter((s) => !s.odeme_tarihi)
  const geciken = bekleyen.filter((s) => s.vade_tarihi < bugun)
  const buAy = bekleyen.filter((s) => s.vade_tarihi.slice(0, 7) === bugun.slice(0, 7))
  const topla = (liste: Senet[]) => liste.reduce((t, s) => t + Number(s.tutar), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Ozet
          baslik="Vadesi geçen"
          adet={geciken.length}
          tutar={topla(geciken)}
          renk={geciken.length > 0 ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-600'}
        />
        <Ozet
          baslik="Bu ay ödenecek"
          adet={buAy.length}
          tutar={topla(buAy)}
          renk="bg-amber-50 text-amber-800"
        />
        <Ozet
          baslik="Toplam bekleyen"
          adet={bekleyen.length}
          tutar={topla(bekleyen)}
          renk="bg-slate-100 text-slate-800"
        />
      </div>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="etiket text-xs" htmlFor="senet-ara">
            Ara
          </label>
          <input
            id="senet-ara"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kime, banka ya da senet no…"
            className="girdi !py-1.5"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-solgun">
          <input
            type="checkbox"
            checked={gizleOdenen}
            onChange={(e) => setGizleOdenen(e.target.checked)}
          />
          Ödenenleri gizle
        </label>
        {!acik && (
          <button type="button" onClick={() => setAcik(true)} className="btn-ikincil !py-1.5">
            + Senet Ekle
          </button>
        )}
      </div>

      {acik && (
        <form action={gonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="etiket text-xs">Vade tarihi</label>
            <input type="date" name="vade_tarihi" defaultValue={bugun} className="girdi !py-1.5" />
            {durum.alanlar?.vade_tarihi && <p className="hata">{durum.alanlar.vade_tarihi}</p>}
          </div>
          <div className="min-w-48 flex-1">
            <label className="etiket text-xs">Kime</label>
            <input name="kime" placeholder="ör. MAHSEN-TUBORG" className="girdi !py-1.5" />
            {durum.alanlar?.kime && <p className="hata">{durum.alanlar.kime}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Tutar (₺)</label>
            <input name="tutar" inputMode="decimal" className="girdi !py-1.5 w-32" />
            {durum.alanlar?.tutar && <p className="hata">{durum.alanlar.tutar}</p>}
          </div>
          <div>
            <label className="etiket text-xs">Banka</label>
            <input name="banka" placeholder="ör. GARANTİ" className="girdi !py-1.5 w-32" />
          </div>
          <div>
            <label className="etiket text-xs">Senet no</label>
            <input name="senet_no" className="girdi !py-1.5 w-40" />
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : 'Ekle'}
          </button>
          <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
        </form>
      )}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Vade</th>
              <th>Kime</th>
              <th className="text-right">Tutar</th>
              <th>Banka</th>
              <th>Senet No</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {gosterilen.map((s) => (
              <SenetSatiri key={s.id} senet={s} bugun={bugun} />
            ))}
            {gosterilen.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-solgun">
                  {arama || gizleOdenen ? 'Filtreye uyan senet yok.' : 'Henüz senet yok.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Ozet({
  baslik,
  adet,
  tutar,
  renk,
}: {
  baslik: string
  adet: number
  tutar: number
  renk: string
}) {
  return (
    <div className={`kart p-4 ${renk}`}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{baslik}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{para(tutar)}</p>
      <p className="mt-0.5 text-xs opacity-75">{adet} senet</p>
    </div>
  )
}

function SenetSatiri({ senet, bugun }: { senet: Senet; bugun: string }) {
  const router = useRouter()
  const [duzenle, setDuzenle] = useState(false)
  const [calisiyor, setCalisiyor] = useState(false)
  const eylem = senetGuncelle.bind(null, senet.id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as FinansDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  const odendi = !!senet.odeme_tarihi
  const fark = gunFarki(senet.vade_tarihi, bugun)
  const gecti = !odendi && fark < 0
  const yakin = !odendi && fark >= 0 && fark <= 7

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={7} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="etiket text-xs">Vade</label>
              <input
                type="date"
                name="vade_tarihi"
                defaultValue={senet.vade_tarihi}
                className="girdi !py-1.5"
              />
            </div>
            <div className="min-w-40 flex-1">
              <label className="etiket text-xs">Kime</label>
              <input name="kime" defaultValue={senet.kime} className="girdi !py-1.5" />
            </div>
            <div>
              <label className="etiket text-xs">Tutar</label>
              <input
                name="tutar"
                inputMode="decimal"
                defaultValue={String(senet.tutar).replace('.', ',')}
                className="girdi !py-1.5 w-32"
              />
            </div>
            <div>
              <label className="etiket text-xs">Banka</label>
              <input
                name="banka"
                defaultValue={senet.banka ?? ''}
                className="girdi !py-1.5 w-32"
              />
            </div>
            <div>
              <label className="etiket text-xs">Senet no</label>
              <input
                name="senet_no"
                defaultValue={senet.senet_no ?? ''}
                className="girdi !py-1.5 w-40"
              />
            </div>
            <button className="btn-birincil !py-1.5" disabled={bekliyor}>
              Kaydet
            </button>
            <button type="button" onClick={() => setDuzenle(false)} className="btn-ikincil !py-1.5">
              Vazgeç
            </button>
            {durum.hata && <p className="hata w-full">{durum.hata}</p>}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className={
        odendi ? 'bg-emerald-50/60' : gecti ? 'bg-red-50' : yakin ? 'bg-amber-50' : undefined
      }
    >
      <td className="whitespace-nowrap font-medium">
        {tarihBicim(senet.vade_tarihi)}
        {gecti && (
          <span className="rozet ml-2 bg-red-100 text-red-800">{-fark} gün geçti</span>
        )}
        {yakin && (
          <span className="rozet ml-2 bg-amber-100 text-amber-800">
            {fark === 0 ? 'bugün' : `${fark} gün kaldı`}
          </span>
        )}
      </td>
      <td className="font-medium">{senet.kime}</td>
      <td className="text-right font-semibold tabular-nums">{para(senet.tutar)}</td>
      <td className="text-solgun">{senet.banka ?? '—'}</td>
      <td className="text-xs text-solgun tabular-nums">{senet.senet_no ?? '—'}</td>
      <td>
        {odendi ? (
          <span className="rozet bg-emerald-100 text-emerald-800">
            ödendi · {tarihBicim(senet.odeme_tarihi)}
          </span>
        ) : (
          <span className="rozet bg-slate-100 text-slate-700">bekliyor</span>
        )}
      </td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          disabled={calisiyor}
          onClick={async () => {
            setCalisiyor(true)
            try {
              const s = await senetOdemeDegistir(senet.id, odendi ? null : bugun)
              if (s.hata) alert(s.hata)
              else router.refresh()
            } finally {
              setCalisiyor(false)
            }
          }}
          className={`text-xs hover:underline ${
            odendi ? 'text-solgun' : 'font-semibold text-emerald-700'
          }`}
        >
          {odendi ? 'Geri al' : 'Ödendi'}
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          onClick={() => setDuzenle(true)}
          className="text-xs text-vurgu hover:underline"
        >
          Düzelt
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          onClick={async () => {
            if (!confirm(`${senet.kime} — ${para(senet.tutar)} senedi silinecek. Emin misiniz?`))
              return
            const s = await senetSil(senet.id)
            if (s.hata) alert(s.hata)
            else router.refresh()
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Sil
        </button>
      </td>
    </tr>
  )
}
