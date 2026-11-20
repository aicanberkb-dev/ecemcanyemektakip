'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useBugun } from '@/components/BugunSaglayici'
import {
  araliktaMi,
  ayEtiketi,
  BOS_ARALIK,
  TarihFiltresi,
  type Aralik,
} from '@/components/TarihFiltresi'
import { para, tarih as tarihBicim } from '@/lib/format'
import { cozumlenemeyen, kartEkstresiOku, type KartHarcamasi } from '@/lib/kart-ekstre'

import { girilmisAnahtarlar, kartHarcamalariniAktar } from './actions'

/** Daha önce deftere yazılmış bir kart harcaması */
export type GirilmisSatir = {
  tarih: string
  tutar: number
  isyeri: string
  hamAd: string
  /** `tarih/fiş/mutabakat`; elle girilmiş eski satırlarda boş olabilir */
  anahtar: string | null
}

type Okunan = KartHarcamasi & { zatenVar: boolean }

const KATEGORI_RENGI: Record<string, string> = {
  'Market / gıda': 'bg-emerald-100 text-emerald-800',
  Akaryakıt: 'bg-amber-100 text-amber-900',
  'Fırın / unlu mamul': 'bg-orange-100 text-orange-900',
  Araç: 'bg-sky-100 text-sky-900',
  'Malzeme / bakım': 'bg-violet-100 text-violet-900',
  Diğer: 'bg-slate-100 text-slate-700',
}

function topla(liste: { tutar: number }[]) {
  return liste.reduce((t, s) => t + s.tutar, 0)
}

/** Listeyi bir anahtara göre gruplayıp tutara göre sıralar */
function grupla<T extends { tutar: number }>(liste: T[], anahtar: (s: T) => string) {
  const m = new Map<string, { ad: string; adet: number; tutar: number }>()
  for (const s of liste) {
    const k = anahtar(s)
    const g = m.get(k) ?? { ad: k, adet: 0, tutar: 0 }
    g.adet++
    g.tutar += s.tutar
    m.set(k, g)
  }
  return [...m.values()].sort((a, b) => b.tutar - a.tutar)
}

export function KartEkrani({ girilmisler }: { girilmisler: GirilmisSatir[] }) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [okuniyor, setOkunuyor] = useState(false)
  const [okunan, setOkunan] = useState<Okunan[] | null>(null)
  const [dosyaAdi, setDosyaAdi] = useState('')
  const [atlanan, setAtlanan] = useState(0)
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)
  const bugun = useBugun()
  const [aralik, setAralik] = useState<Aralik>(BOS_ARALIK)

  async function dosyaSecildi(dosya: File) {
    setMesaj(null)
    setOkunuyor(true)
    try {
      const bayt = new Uint8Array(await dosya.arrayBuffer())
      const harcamalar = kartEkstresiOku(bayt)
      const kacan = cozumlenemeyen(bayt)

      if (harcamalar.length === 0) {
        setOkunan([])
        setDosyaAdi(dosya.name)
        setMesaj({
          tip: 'hata',
          metin:
            'Dosyada kart harcaması bulunamadı. Ziraat "Hesap Hareketleri" dosyası olduğundan emin olun.',
        })
        return
      }

      // Fiş numarası deftere yazılıyor; daha önce girilenler buradan anlaşılıyor
      const zaten = new Set(await girilmisAnahtarlar(harcamalar.map((h) => h.anahtar)))
      const liste: Okunan[] = harcamalar.map((h) => ({ ...h, zatenVar: zaten.has(h.anahtar) }))

      setOkunan(liste)
      setDosyaAdi(dosya.name)
      setAtlanan(kacan)
      // Yalnızca yeni satırlar işaretli gelir
      setSecili(new Set(liste.filter((h) => !h.zatenVar).map((h) => h.anahtar)))

      if (kacan > 0) {
        setMesaj({
          tip: 'hata',
          metin: `${kacan} POS satırı çözümlenemedi — açıklama kalıbı değişmiş olabilir. Aktarmadan önce kontrol edin.`,
        })
      }
    } catch (e) {
      setMesaj({ tip: 'hata', metin: e instanceof Error ? e.message : 'Dosya okunamadı.' })
    } finally {
      setOkunuyor(false)
    }
  }

  function degistir(anahtar: string) {
    setSecili((eski) => {
      const yeni = new Set(eski)
      if (yeni.has(anahtar)) yeni.delete(anahtar)
      else yeni.add(anahtar)
      return yeni
    })
  }

  function aktar() {
    if (!okunan) return
    const yazilacak = okunan.filter((h) => secili.has(h.anahtar))
    if (yazilacak.length === 0) return

    if (
      !window.confirm(
        `${yazilacak.length} kart harcaması günlük masrafa yazılacak — toplam ${para(
          topla(yazilacak),
        )}. Onaylıyor musun?`,
      )
    )
      return

    baslat(async () => {
      const sonuc = await kartHarcamalariniAktar(
        yazilacak.map((h) => ({
          tarih: h.tarih,
          anahtar: h.anahtar,
          isyeri: h.isyeri,
          hamAd: h.hamAd,
          tutar: h.tutar,
        })),
      )
      if (sonuc.hata) setMesaj({ tip: 'hata', metin: sonuc.hata })
      else {
        setMesaj({ tip: 'ok', metin: sonuc.basari ?? 'Aktarıldı.' })
        // Yazılanlar artık "zaten var"; liste dursun ama işaretler kalksın
        setOkunan(
          okunan.map((h) => (secili.has(h.anahtar) ? { ...h, zatenVar: true } : h)),
        )
        setSecili(new Set())
        router.refresh()
      }
    })
  }

  const yeniler = okunan?.filter((h) => !h.zatenVar) ?? []
  const mukerrer = (okunan?.length ?? 0) - yeniler.length

  // Rapor: deftere aktarılmış kart harcamaları, seçili tarih aralığında
  const suzulmus = useMemo(
    () => girilmisler.filter((s) => araliktaMi(s.tarih, aralik)),
    [girilmisler, aralik],
  )

  const aylar = useMemo(
    () => [...new Set(girilmisler.map((s) => s.tarih.slice(0, 7)))].sort().reverse(),
    [girilmisler],
  )

  const rapor = useMemo(
    () => ({
      toplam: topla(suzulmus),
      isyerleri: grupla(suzulmus, (s) => s.isyeri).slice(0, 12),
      aylar: grupla(suzulmus, (s) => s.tarih.slice(0, 7)).sort((a, b) =>
        b.ad.localeCompare(a.ad),
      ),
    }),
    [suzulmus],
  )

  return (
    <div className="space-y-5">
      {/* Aktarım */}
      <div className="kart p-4">
        <label className="etiket" htmlFor="kart-dosya">
          Banka ekstresi (Excel)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="kart-dosya"
            type="file"
            accept=".xlsx"
            disabled={okuniyor || bekliyor}
            onChange={(e) => {
              const d = e.target.files?.[0]
              if (d) void dosyaSecildi(d)
            }}
            className="girdi grow file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
          />
          {okuniyor && <span className="text-sm text-solgun">Okunuyor…</span>}
        </div>
        {dosyaAdi && !okuniyor && (
          <p className="mt-2 text-xs text-solgun">
            {dosyaAdi} — {okunan?.length ?? 0} kart harcaması okundu
            {mukerrer > 0 && `, ${mukerrer} tanesi daha önce girilmiş`}
            {atlanan > 0 && `, ${atlanan} satır çözümlenemedi`}.
          </p>
        )}
      </div>

      {mesaj && (
        <p
          className={`rounded-md px-4 py-3 text-sm ${
            mesaj.tip === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      {okunan && okunan.length > 0 && (
        <div className="kart overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-cizgi bg-slate-50 px-4 py-3 text-sm">
            <span>
              <strong>{secili.size}</strong> satır seçili ·{' '}
              <strong className="tabular-nums">
                {para(topla(okunan.filter((h) => secili.has(h.anahtar))))}
              </strong>
            </span>
            {mukerrer > 0 && (
              <span className="text-solgun">{mukerrer} satır daha önce aktarılmış</span>
            )}
            <button
              type="button"
              className="text-xs text-vurgu hover:underline"
              onClick={() => setSecili(new Set(yeniler.map((h) => h.anahtar)))}
            >
              Yenilerin hepsini seç
            </button>
            <button
              type="button"
              className="text-xs text-vurgu hover:underline"
              onClick={() => setSecili(new Set())}
            >
              Seçimi kaldır
            </button>
            <button
              type="button"
              className="btn-birincil ml-auto !py-1.5"
              disabled={bekliyor || secili.size === 0}
              onClick={aktar}
            >
              {bekliyor ? 'Yazılıyor…' : 'Günlük Masrafa Aktar'}
            </button>
          </div>

          <div className="max-h-[480px] overflow-auto">
            <table className="tablo">
              <thead>
                <tr>
                  <th className="w-8" />
                  <th>Tarih</th>
                  <th>Masraf noktası</th>
                  <th>Bankadaki ad</th>
                  <th>Kategori</th>
                  <th className="text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {okunan.map((h) => (
                  <tr key={h.anahtar} className={h.zatenVar ? 'bg-slate-50 text-solgun' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={secili.has(h.anahtar)}
                        disabled={h.zatenVar}
                        onChange={() => degistir(h.anahtar)}
                        className="accent-indigo-600"
                        aria-label={`${h.isyeri} ${para(h.tutar)}`}
                      />
                    </td>
                    <td className="whitespace-nowrap">{tarihBicim(h.tarih)}</td>
                    <td className="font-medium">{h.isyeri}</td>
                    <td className="text-xs text-solgun">{h.hamAd}</td>
                    <td>
                      <span className={`rozet ${KATEGORI_RENGI[h.kategori] ?? ''}`}>
                        {h.kategori}
                      </span>
                    </td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums">
                      {para(h.tutar)}
                      {h.zatenVar && <span className="ml-2 text-[10px]">girildi</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kümülatif rapor */}
      <div>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-solgun uppercase">
          Aktarılmış kart harcamaları
        </h2>

        {girilmisler.length === 0 ? (
          <p className="kart p-4 text-sm text-solgun">
            Henüz kart harcaması aktarılmadı.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="kart p-4">
              <TarihFiltresi
                bugun={bugun}
                aralik={aralik}
                degistir={setAralik}
                aylar={aylar}
                ozet={
                  <>
                    <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
                      {aralik.ay ? ayEtiketi(aralik.ay) : 'Seçili aralık'} toplamı
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-indigo-700">
                      {para(rapor.toplam)}
                    </p>
                    <p className="text-xs text-solgun">
                      {suzulmus.length} / {girilmisler.length} harcama
                    </p>
                  </>
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="kart bg-indigo-50 p-4 text-indigo-900">
                <p className="text-xs font-semibold tracking-wide uppercase opacity-80">
                  Toplam
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{para(rapor.toplam)}</p>
                <p className="mt-0.5 text-xs opacity-75">{suzulmus.length} harcama</p>
              </div>
              <div className="kart p-4">
                <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
                  İşyeri
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {new Set(suzulmus.map((g) => g.isyeri)).size}
                </p>
                <p className="mt-0.5 text-xs text-solgun">farklı masraf noktası</p>
              </div>
              <div className="kart p-4">
                <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
                  Harcama başına
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {para(suzulmus.length > 0 ? rapor.toplam / suzulmus.length : 0)}
                </p>
                <p className="mt-0.5 text-xs text-solgun">ortalama</p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="kart overflow-hidden">
                <h3 className="border-b border-cizgi bg-slate-50 px-4 py-2.5 text-sm font-semibold">
                  Aya göre
                </h3>
                <table className="tablo">
                  <tbody>
                    {rapor.aylar.map((a) => (
                      <tr key={a.ad}>
                        <td className="whitespace-nowrap">
                          {a.ad.slice(5)}.{a.ad.slice(0, 4)}
                        </td>
                        <td className="text-solgun">{a.adet} harcama</td>
                        <td className="text-right font-semibold whitespace-nowrap tabular-nums">
                          {para(a.tutar)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="kart overflow-hidden">
                <h3 className="border-b border-cizgi bg-slate-50 px-4 py-2.5 text-sm font-semibold">
                  En çok harcanan yerler
                </h3>
                <table className="tablo">
                  <tbody>
                    {rapor.isyerleri.map((g) => (
                      <tr key={g.ad}>
                        <td className="font-medium">{g.ad}</td>
                        <td className="text-solgun">{g.adet} harcama</td>
                        <td className="text-right font-semibold whitespace-nowrap tabular-nums">
                          {para(g.tutar)}
                        </td>
                        <td className="w-24">
                          <span
                            className="block h-2 rounded bg-indigo-500"
                            style={{
                              width: `${(g.tutar / rapor.isyerleri[0].tutar) * 100}%`,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
