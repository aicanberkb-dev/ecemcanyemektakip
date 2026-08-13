'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { AboneRozeti, Bakiye, OgrenciTipiRozeti } from '@/components/Rozetler'
import { aramaEslesir } from '@/lib/arama'
import { para, tarih as tarihBicim } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { AboneTipi, OgrenciTipi } from '@/lib/types'

export type TopluOgrenci = {
  student_id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  abone_tipi: AboneTipi
  ogrenci_tipi: OgrenciTipi
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
  // Toplu girişte hata yapılabiliyor; aynı ekrandan geri alınabilmeli.
  const [mod, setMod] = useState<'ekle' | 'geri'>('ekle')
  const [mesaj, setMesaj] = useState<Mesaj | null>(null)

  // Zaten kaydı olanlar seçilemez
  const secilebilir = ogrenciler.filter((o) => !o.zaten_kayitli)

  const gosterilen = useMemo(() => {
    const t = arama.trim()
    return ogrenciler.filter((o) => {
      if (sinif && o.sinif !== sinif) return false
      if (!t) return true
      return aramaEslesir(`${o.ad_soyad} ${o.ogrenci_no}`, t)
    })
  }, [ogrenciler, arama, sinif])

  // Ekleme modunda kaydı olmayanlar, geri alma modunda kaydı olanlar seçilebilir.
  const secilebilirMi = (o: TopluOgrenci) => (mod === 'ekle' ? !o.zaten_kayitli : o.zaten_kayitli)
  const gosterilenSecilebilir = gosterilen.filter(secilebilirMi)
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

  // Aylıkçının öğünü 0 ₺ olduğu için tutar yalnızca günlükçülerden oluşur;
  // geri almada da aynı tutar iade edilir.
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

  async function geriAl() {
    if (secili.size === 0 || kaydediliyor) return
    if (
      !confirm(
        `${secili.size} öğrencinin ${tarihBicim(gun)} tarihli yemek kaydı SİLİNECEK.\n` +
          `Günlükçülere toplam ${para(toplamTutar)} iade edilecek. Onaylıyor musunuz?`,
      )
    )
      return

    setKaydediliyor(true)
    const { data, error } = await supabase.rpc('toplu_yemek_geri_al', {
      p_ogrenciler: [...secili],
      p_tarih: gun,
    })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }

    const sonuc = (data as { silinen: number; atlanan: number }[] | null)?.[0]
    setMesaj({
      tip: 'ok',
      metin:
        `${sonuc?.silinen ?? 0} yemek kaydı geri alındı` +
        (sonuc?.atlanan ? ` — ${sonuc.atlanan} öğrencide o tarihte kayıt yoktu.` : '.'),
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
      <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-cizgi bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(['ekle', 'geri'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMod(m)
                setSecili(new Set())
                setMesaj(null)
              }}
              className={`rounded-md border px-3 py-2 text-sm ${
                m === mod
                  ? m === 'ekle'
                    ? 'border-vurgu bg-blue-50 font-semibold text-vurgu'
                    : 'border-red-500 bg-red-50 font-semibold text-red-700'
                  : 'border-cizgi hover:bg-gray-50'
              }`}
            >
              {m === 'ekle' ? 'Yemek Yedir' : 'Yemeği Geri Al'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={tumunuDegistir} className="btn-ikincil">
            {hepsiSecili ? 'Seçimi kaldır' : 'Tümünü seç'}
          </button>
          <span className="text-sm text-solgun">
            <strong className="text-metin">{secili.size}</strong> seçili
            {secili.size > 0 && (
              <>
                {' '}
                · {mod === 'ekle' ? 'düşecek' : 'iade edilecek'} tutar {para(toplamTutar)}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={mod === 'ekle' ? kaydet : geriAl}
            disabled={secili.size === 0 || kaydediliyor}
            className={`ml-auto ${mod === 'ekle' ? 'btn-birincil' : 'btn-tehlike'}`}
          >
            {kaydediliyor
              ? mod === 'ekle'
                ? 'Kaydediliyor…'
                : 'Geri alınıyor…'
              : mod === 'ekle'
                ? `${tarihBicim(gun)} için Yemek Kaydet`
                : `${tarihBicim(gun)} Kaydını Geri Al`}
          </button>
        </div>
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
                  onClick={() => secilebilirMi(o) && degistir(o.student_id)}
                  className={`${secilebilirMi(o) ? 'cursor-pointer' : 'opacity-50'} ${
                    isaretli ? (mod === 'ekle' ? 'bg-blue-50' : 'bg-red-50') : ''
                  }`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isaretli}
                      disabled={!secilebilirMi(o)}
                      onChange={() => degistir(o.student_id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`size-4 cursor-pointer ${
                        mod === 'ekle' ? 'accent-blue-600' : 'accent-red-600'
                      }`}
                      aria-label={`${o.ad_soyad} seç`}
                    />
                  </td>
                  <td className="tabular-nums text-solgun">{o.ogrenci_no}</td>
                  <td className="font-medium">
                    {o.ad_soyad}
                    {o.zaten_kayitli && (
                      <span className="rozet ml-2 bg-slate-200 text-slate-600">
                        {mod === 'ekle' ? 'zaten kayıtlı' : 'kayıtlı'}
                      </span>
                    )}
                  </td>
                  <td>{o.sinif ?? '—'}</td>
                  <td>
                    <AboneRozeti tip={o.abone_tipi} />
                    <OgrenciTipiRozeti tip={o.ogrenci_tipi} />
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
