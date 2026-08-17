'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { AY_ADLARI } from '@/lib/format'

import { menuKopyala, type MenuDurumu } from './actions'

/**
 * Başka bir listenin ya da ayın menüsünü buraya kopyalar.
 *
 * GÖKSU ile AHMET MİTHAT menüleri neredeyse aynı, aylar da büyük ölçüde
 * tekrar ediyor. Sıfırdan yazmak yerine kopyalayıp üzerinde oynamak çok daha
 * hızlı; kopya sonrası liste kendi içinde bağımsız düzenlenir.
 */
export function MenuKopyalaFormu({
  hedefListeId,
  hedefYil,
  hedefAy,
  kaynaklar,
}: {
  hedefListeId: string
  hedefYil: number
  hedefAy: number
  kaynaklar: { id: string; ad: string }[]
}) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [durum, setDurum] = useState<MenuDurumu>({})
  const [calisiyor, basla] = useTransition()

  const oncekiAy = hedefAy === 1 ? 12 : hedefAy - 1
  const oncekiYil = hedefAy === 1 ? hedefYil - 1 : hedefYil

  const [kaynakListe, setKaynakListe] = useState(hedefListeId)
  const [kaynakAy, setKaynakAy] = useState(oncekiAy)
  const [kaynakYil, setKaynakYil] = useState(oncekiYil)

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="btn-ikincil">
        Başka listeden/aydan kopyala
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-cizgi p-3">
      <div>
        <label className="etiket text-xs">Kaynak liste</label>
        <select
          value={kaynakListe}
          onChange={(e) => setKaynakListe(e.target.value)}
          className="girdi !py-1.5"
        >
          {kaynaklar.map((k) => (
            <option key={k.id} value={k.id}>
              {k.ad}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiket text-xs">Kaynak ay</label>
        <select
          value={kaynakAy}
          onChange={(e) => setKaynakAy(Number(e.target.value))}
          className="girdi !py-1.5"
        >
          {AY_ADLARI.map((adi, i) => (
            <option key={adi} value={i + 1}>
              {adi}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="etiket text-xs">Yıl</label>
        <input
          type="number"
          value={kaynakYil}
          onChange={(e) => setKaynakYil(Number(e.target.value))}
          className="girdi !py-1.5 w-24"
        />
      </div>
      <button
        type="button"
        disabled={calisiyor}
        onClick={() =>
          basla(async () => {
            const s = await menuKopyala(
              kaynakListe,
              kaynakYil,
              kaynakAy,
              hedefListeId,
              hedefYil,
              hedefAy,
            )
            setDurum(s)
            if (s.basari) {
              setAcik(false)
              router.refresh()
            }
          })
        }
        className="btn-birincil !py-1.5"
      >
        {calisiyor ? 'Kopyalanıyor…' : 'Kopyala'}
      </button>
      <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
        Vazgeç
      </button>
      {durum.hata && <p className="hata w-full">{durum.hata}</p>}
    </div>
  )
}
