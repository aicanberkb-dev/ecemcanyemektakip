'use client'

import { useMemo, useState, useTransition } from 'react'

import { aramaEslesir } from '@/lib/arama'
import { AY_ADLARI } from '@/lib/format'

import { menuKaydet, type MenuDurumu, type MenuGunGirdisi } from './actions'

export type MenuGunu = {
  tarih: string
  corba: string | null
  ana_yemek: string | null
  yardimci: string | null
  ek: string | null
}

export type HavuzKaydi = {
  kategori: 'corba' | 'ana_yemek' | 'yardimci' | 'ek'
  ad: string
  kullanim: number
}

type Alan = 'corba' | 'ana_yemek' | 'yardimci' | 'ek'

const RENKLER: Record<Alan, string> = {
  corba: 'bg-orange-50 border-orange-200',
  ana_yemek: 'bg-red-50 border-red-200',
  yardimci: 'bg-amber-50 border-amber-200',
  ek: 'bg-sky-50 border-sky-200',
}

/** Taşımalıda satırlar serbest (çorba/sandviç/meyve); okul menüsünde sabit. */
function alanlar(satirSayisi: number): { anahtar: Alan; etiket: string }[] {
  const dort = [
    { anahtar: 'corba' as Alan, etiket: 'Çorba' },
    { anahtar: 'ana_yemek' as Alan, etiket: 'Ana Yemek' },
    { anahtar: 'yardimci' as Alan, etiket: 'Yardımcı' },
    { anahtar: 'ek' as Alan, etiket: '4. Kalem' },
  ]
  if (satirSayisi >= 4) return dort
  return [
    { anahtar: 'corba' as Alan, etiket: '1. Kalem' },
    { anahtar: 'ana_yemek' as Alan, etiket: '2. Kalem' },
    { anahtar: 'yardimci' as Alan, etiket: '3. Kalem' },
  ]
}

/**
 * Aylık menü düzenleyici.
 *
 * Solda geçmiş menülerden türeyen yemek havuzu, sağda ayın günleri. Havuzdaki
 * bir yemeği güne sürükleyip bırakmak ya da önce yemeği sonra hücreyi
 * tıklamak aynı işi yapar — fare kullanmadan da çalışsın diye ikisi de var.
 */
export function MenuEkrani({
  listeId,
  satirSayisi,
  yil,
  ay,
  menu,
  havuz,
}: {
  listeId: string
  satirSayisi: number
  yil: number
  ay: number
  menu: MenuGunu[]
  havuz: HavuzKaydi[]
}) {
  const ALANLAR = alanlar(satirSayisi)
  const gunSayisi = new Date(yil, ay, 0).getDate()

  const baslangic = useMemo(() => {
    const m = new Map<string, MenuGunu>()
    for (const g of menu) m.set(g.tarih, g)
    const liste: MenuGunGirdisi[] = []
    for (let g = 1; g <= gunSayisi; g++) {
      const h = new Date(yil, ay - 1, g).getDay()
      if (h === 0 || h === 6) continue // hafta sonu menüsü yok
      const tarih = `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
      const mevcut = m.get(tarih)
      liste.push({
        tarih,
        corba: mevcut?.corba ?? '',
        ana_yemek: mevcut?.ana_yemek ?? '',
        yardimci: mevcut?.yardimci ?? '',
        ek: mevcut?.ek ?? '',
      })
    }
    return liste
  }, [menu, yil, ay, gunSayisi])

  const [gunler, setGunler] = useState<MenuGunGirdisi[]>(baslangic)
  const [anahtar, setAnahtar] = useState(`${listeId}-${yil}-${ay}`)
  const [secili, setSecili] = useState<{ kategori: Alan; ad: string } | null>(null)
  const [isaretli, setIsaretli] = useState<Set<string>>(new Set())
  const [durum, setDurum] = useState<MenuDurumu>({})
  const [kaydediliyor, basla] = useTransition()
  const [havuzArama, setHavuzArama] = useState('')

  // Liste ya da ay değişince tablo yeniden kurulur
  if (anahtar !== `${listeId}-${yil}-${ay}`) {
    setAnahtar(`${listeId}-${yil}-${ay}`)
    setGunler(baslangic)
    setIsaretli(new Set())
    setDurum({})
  }

  function yaz(tarih: string, alan: Alan, deger: string) {
    setGunler((o) => o.map((g) => (g.tarih === tarih ? { ...g, [alan]: deger } : g)))
    setDurum({})
  }

  /** Ekranda yazılan yeni yemekler de havuzda görünsün — kaydı beklemeden. */
  const canliHavuz = useMemo(() => {
    const map = new Map<string, HavuzKaydi>()
    for (const h of havuz) map.set(`${h.kategori}|${h.ad}`, h)
    for (const g of gunler) {
      for (const a of ALANLAR) {
        const ad = ((g[a.anahtar] as string) ?? '').trim().toLocaleUpperCase('tr')
        if (!ad) continue
        const k = `${a.anahtar}|${ad}`
        if (!map.has(k)) map.set(k, { kategori: a.anahtar, ad, kullanim: 0 })
      }
    }
    return [...map.values()]
  }, [havuz, gunler, ALANLAR])

  const havuzGosterilen = useMemo(
    () => canliHavuz.filter((h) => aramaEslesir(h.ad, havuzArama)),
    [canliHavuz, havuzArama],
  )

  function satirTemizle(tarih: string) {
    setGunler((o) =>
      o.map((g) =>
        g.tarih === tarih ? { tarih, corba: '', ana_yemek: '', yardimci: '', ek: '' } : g,
      ),
    )
    setDurum({})
  }

  function hucreDegistir(tarih: string, alan: Alan) {
    const k = `${tarih}|${alan}`
    setIsaretli((o) => {
      const y = new Set(o)
      if (y.has(k)) y.delete(k)
      else y.add(k)
      return y
    })
  }

  function isaretlileriSil() {
    if (isaretli.size === 0) return
    setGunler((o) =>
      o.map((g) => {
        const yeni = { ...g }
        for (const a of ALANLAR) {
          if (isaretli.has(`${g.tarih}|${a.anahtar}`)) yeni[a.anahtar] = ''
        }
        return yeni
      }),
    )
    setIsaretli(new Set())
    setDurum({})
  }

  function kaydet() {
    basla(async () => setDurum(await menuKaydet(listeId, gunler)))
  }

  const doluGun = gunler.filter((g) => g.corba || g.ana_yemek || g.yardimci || g.ek).length

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      {/* Yemek havuzu */}
      <aside className="kart h-fit p-4 lg:sticky lg:top-4">
        <h2 className="font-semibold">Yemek Havuzu</h2>
        <p className="mt-1 text-xs text-solgun">
          Bir yemeği <strong>sürükleyip</strong> güne bırakın ya da{' '}
          <strong>tıklayıp</strong> sonra hedef kutuyu tıklayın. Yeni yazdığınız yemek
          havuza hemen eklenir.
        </p>
        <input
          value={havuzArama}
          onChange={(e) => setHavuzArama(e.target.value)}
          placeholder="Yemek ara…"
          className="girdi mt-3 !py-1.5"
        />

        {secili && (
          <p className="mt-2 rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-900">
            <strong>{secili.ad}</strong> seçili — yerleştirmek için bir kutuya tıklayın.
            <button type="button" onClick={() => setSecili(null)} className="ml-2 underline">
              vazgeç
            </button>
          </p>
        )}

        <div className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
          {ALANLAR.map((a) => {
            const liste = havuzGosterilen.filter((h) => h.kategori === a.anahtar)
            if (liste.length === 0) return null
            return (
              <div key={a.anahtar}>
                <p className="mb-1 text-xs font-semibold text-solgun">{a.etiket}</p>
                <div className="flex flex-wrap gap-1">
                  {liste.map((h) => (
                    <button
                      key={h.ad}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'text/plain',
                          JSON.stringify({ kategori: a.anahtar, ad: h.ad }),
                        )
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() =>
                        setSecili(
                          secili?.ad === h.ad && secili.kategori === a.anahtar
                            ? null
                            : { kategori: a.anahtar, ad: h.ad },
                        )
                      }
                      className={`cursor-grab rounded border px-2 py-1 text-xs active:cursor-grabbing ${
                        secili?.ad === h.ad && secili.kategori === a.anahtar
                          ? 'border-vurgu bg-blue-100 font-semibold text-vurgu'
                          : `${RENKLER[a.anahtar]} hover:brightness-95`
                      }`}
                      title={h.kullanim > 0 ? `${h.kullanim} kez kullanıldı` : 'yeni'}
                    >
                      {h.ad}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {havuzGosterilen.length === 0 && (
            <p className="text-xs text-solgun">Havuz boş — menü girdikçe dolar.</p>
          )}
        </div>
      </aside>

      {/* Ay tablosu */}
      <div className="space-y-3">
        <div className="kart flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm">
            <strong>
              {AY_ADLARI[ay - 1]} {yil}
            </strong>{' '}
            · {gunler.length} hafta içi gün · {doluGun} günde menü var
          </span>

          {isaretli.size > 0 && (
            <button type="button" onClick={isaretlileriSil} className="btn-ikincil !py-1.5">
              Seçili {isaretli.size} kutuyu temizle
            </button>
          )}

          <button
            type="button"
            onClick={kaydet}
            disabled={kaydediliyor}
            className="btn-birincil ml-auto"
          >
            {kaydediliyor ? 'Kaydediliyor…' : 'Menüyü Kaydet'}
          </button>
          {durum.basari && (
            <span className="text-sm font-medium text-emerald-700">{durum.basari}</span>
          )}
          {durum.hata && <span className="hata">{durum.hata}</span>}
        </div>

        <div className="kart overflow-x-auto">
          <table className="tablo">
            <thead>
              <tr>
                <th className="w-32">Gün</th>
                {ALANLAR.map((a) => (
                  <th key={a.anahtar}>{a.etiket}</th>
                ))}
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {gunler.map((g) => {
                const d = new Date(g.tarih)
                const gunAdi = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][d.getDay()]
                const doluMu = ALANLAR.some((a) => (g[a.anahtar] as string)?.trim())
                return (
                  <tr key={g.tarih}>
                    <td className="whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{d.getDate()}</span>
                      <span className="ml-1 text-xs text-solgun">{gunAdi}</span>
                    </td>
                    {ALANLAR.map((a) => {
                      const k = `${g.tarih}|${a.anahtar}`
                      const secildi = isaretli.has(k)
                      return (
                        <td key={a.anahtar} className="!p-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={secildi}
                              onChange={() => hucreDegistir(g.tarih, a.anahtar)}
                              title="Toplu temizlemek için seç"
                              className="shrink-0"
                            />
                            <input
                              value={(g[a.anahtar] as string) ?? ''}
                              onChange={(e) => yaz(g.tarih, a.anahtar, e.target.value)}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'copy'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                try {
                                  const v = JSON.parse(e.dataTransfer.getData('text/plain'))
                                  if (v?.ad) yaz(g.tarih, a.anahtar, v.ad)
                                } catch {
                                  /* sürüklenen veri tanınmadı, yok say */
                                }
                              }}
                              onClick={() => {
                                if (secili) {
                                  yaz(g.tarih, a.anahtar, secili.ad)
                                  setSecili(null)
                                }
                              }}
                              placeholder="—"
                              className={`w-full min-w-36 rounded border px-2 py-1.5 text-sm outline-none
                                          focus:border-vurgu focus:ring-2 focus:ring-blue-100
                                          ${secildi ? 'ring-2 ring-red-200' : ''}
                                          ${
                                            (g[a.anahtar] as string)
                                              ? 'border-cizgi bg-white'
                                              : 'border-dashed border-slate-300 bg-slate-50'
                                          }`}
                            />
                          </div>
                        </td>
                      )
                    })}
                    <td className="text-right">
                      {doluMu && (
                        <button
                          type="button"
                          onClick={() => satirTemizle(g.tarih)}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          title="Bu günün tüm satırını temizle"
                        >
                          Satırı sil
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-solgun">
          Yalnızca hafta içi günler listelenir. <strong>Satırı sil</strong> o günü tamamen
          boşaltır; tek tek kutuları temizlemek için kutucukları işaretleyip{' '}
          <strong>Seçili kutuları temizle</strong> deyin. Değişiklikler{' '}
          <strong>Menüyü Kaydet</strong> ile yazılır — silme dahil.
        </p>
      </div>
    </div>
  )
}
