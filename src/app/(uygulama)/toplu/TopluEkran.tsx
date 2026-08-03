'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { AboneRozeti, Bakiye } from '@/components/Rozetler'
import { para, tarih as tarihBicim } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { AboneTipi } from '@/lib/types'

export type TopluOgrenci = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  abone_tipi: AboneTipi
  kalan: number
  gunluk_ucret: number
  zaten_kayitli: boolean
}

type Mesaj = { tip: 'ok' | 'hata'; metin: string }

export function TopluEkran({
  gun,
  ogrenciler,
  siniflar,
}: {
  gun: string
  ogrenciler: TopluOgrenci[]
  siniflar: string[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [arama, setArama] = useState('')
  const [sinif, setSinif] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [mesaj, setMesaj] = useState<Mesaj | null>(null)

  // Zaten kaydı olanlar seçilemez
  const secilebilir = ogrenciler.filter((o) => !o.zaten_kayitli)

  const gosterilen = useMemo(() => {
    const t = arama.trim().toLocaleLowerCase('tr')
    return ogrenciler.filter((o) => {
      if (sinif && o.sinif !== sinif) return false
      if (!t) return true
      return (
        o.ad_soyad.toLocaleLowerCase('tr').includes(t) ||
        o.ogrenci_no.includes(t)
      )
    })
  }, [ogrenciler, arama, sinif])

  const gosterilenSecilebilir = gosterilen.filter((o) => !o.zaten_kayitli)
  const hepsiSecili =
    gosterilenSecilebilir.length > 0 &&
    gosterilenSecilebilir.every((o) => secili.has(o.student_id))

  function degistir(id: string) {
    setSecili((eski) => {
      const yeni = new Set(eski)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
  }

  /** Listede görünen (filtreye uyan) seçilebilir öğrencilerin hepsini seç/bırak */
  function tumunuDegistir() {
    setSecili((eski) => {
      const yeni = new Set(eski)
      if (hepsiSecili) gosterilenSecilebilir.forEach((o) => yeni.delete(o.student_id))
      else gosterilenSecilebilir.forEach((o) => yeni.add(o.student_id))
      return yeni
    })
  }

  const toplamTutar = ogrenciler
    .filter((o) => secili.has(o.student_id))
    .reduce((t, o) => t + (o.abone_tipi === 'aylik' ? 0 : o.gunluk_ucret), 0)

  async function kaydet() {
    if (secili.size === 0 || kaydediliyor) return
    if (
      !confirm(
        `${secili.size} öğrenci için ${tarihBicim(gun)} tarihine yemek kaydı girilecek.\n` +
          `Toplam ${para(toplamTutar)} düşülecek. Onaylıyor musunuz?`,
      )
    )
      return

    setKaydediliyor(true)
    const { data, error } = await supabase.rpc('toplu_yemek_kaydet', {
      p_ogrenciler: [...secili],
      p_tarih: gun,
    })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }

    const sonuc = (data as { eklenen: number; atlanan: number }[] | null)?.[0]
    setMesaj({
      tip: 'ok',
      metin:
        `${sonuc?.eklenen ?? 0} öğrenciye yemek kaydı girildi` +
        (sonuc?.atlanan ? ` — ${sonuc.atlanan} öğrenci zaten kayıtlıydı, atlandı.` : '.'),
    })
    setSecili(new Set())
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Tarih + filtreler */}
      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <form className="flex items-end gap-2">
          <div>
            <label className="etiket" htmlFor="gun">
              Tarih
            </label>
            <input id="gun" type="date" name="gun" defaultValue={gun} className="girdi" />
          </div>
          <button className="btn-ikincil">Değiştir</button>
        </form>

        <div className="min-w-48 flex-1">
          <label className="etiket" htmlFor="ara">
            Ad veya no ara
          </label>
          <input
            id="ara"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="girdi"
            placeholder="Filtrele…"
          />
        </div>

        <div>
          <label className="etiket" htmlFor="sinif">
            Sınıf
          </label>
          <select
            id="sinif"
            value={sinif}
            onChange={(e) => setSinif(e.target.value)}
            className="girdi"
          >
            <option value="">Hepsi</option>
            {siniflar.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Eylem çubuğu */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-cizgi bg-white p-4 shadow-sm">
        <button type="button" onClick={tumunuDegistir} className="btn-ikincil">
          {hepsiSecili ? 'Seçimi kaldır' : 'Tümünü seç'}
        </button>
        <span className="text-sm text-solgun">
          <strong className="text-metin">{secili.size}</strong> seçili
          {secili.size > 0 && <> · düşecek tutar {para(toplamTutar)}</>}
        </span>
        <button
          type="button"
          onClick={kaydet}
          disabled={secili.size === 0 || kaydediliyor}
          className="btn-birincil ml-auto"
        >
          {kaydediliyor
            ? 'Kaydediliyor…'
            : `${tarihBicim(gun)} için Yemek Kaydet`}
        </button>
      </div>

      {mesaj && (
        <p
          className={`rounded-md px-4 py-3 text-sm font-medium ${
            mesaj.tip === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      {/* Liste */}
      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={hepsiSecili}
                  onChange={tumunuDegistir}
                  className="size-4 cursor-pointer accent-blue-600"
                  aria-label="Tümünü seç"
                />
              </th>
              <th>No</th>
              <th>Ad Soyad</th>
              <th>Sınıf</th>
              <th>Abone</th>
              <th className="text-right">Kalan</th>
              <th className="text-right">Düşecek</th>
            </tr>
          </thead>
          <tbody>
            {gosterilen.map((o) => {
              const isaretli = secili.has(o.student_id)
              return (
                <tr
                  key={o.student_id}
                  onClick={() => !o.zaten_kayitli && degistir(o.student_id)}
                  className={`${o.zaten_kayitli ? 'opacity-50' : 'cursor-pointer'} ${
                    isaretli ? 'bg-blue-50' : ''
                  }`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isaretli}
                      disabled={o.zaten_kayitli}
                      onChange={() => degistir(o.student_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="size-4 cursor-pointer accent-blue-600"
                      aria-label={`${o.ad_soyad} seç`}
                    />
                  </td>
                  <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                  <td className="font-medium">
                    {o.ad_soyad}
                    {o.zaten_kayitli && (
                      <span className="rozet ml-2 bg-slate-200 text-slate-600">
                        zaten kayıtlı
                      </span>
                    )}
                  </td>
                  <td>{o.sinif ?? '—'}</td>
                  <td>
                    <AboneRozeti tip={o.abone_tipi} />
                  </td>
                  <td className="text-right">
                    <Bakiye tutar={o.kalan} />
                  </td>
                  <td className="text-right tabular-nums text-solgun">
                    {o.abone_tipi === 'aylik' ? '—' : para(o.gunluk_ucret)}
                  </td>
                </tr>
              )
            })}
            {gosterilen.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-solgun">
                  Öğrenci bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
          {gosterilen.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 text-sm">
                <td colSpan={7} className="px-3 py-2 text-solgun">
                  {gosterilen.length} öğrenci gösteriliyor ·{' '}
                  {secilebilir.length} kayıt girilebilir ·{' '}
                  {ogrenciler.length - secilebilir.length} zaten kayıtlı
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
