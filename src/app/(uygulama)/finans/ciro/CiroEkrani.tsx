'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'

import { useBugun, useBugunTarihi } from '@/components/BugunSaglayici'
import {
  gunAdi,
  gunAraligi,
  haftaSonuMu,
  para,
  tarih as tarihBicim,
} from '@/lib/format'

import { ciroKaydet, ciroSil, type FinansDurumu } from '../actions'

export type CiroSatiri = {
  id: string
  tarih: string
  yer: string
  /** Toplam — nakit + kart */
  tutar: number | string
  nakit: number | string
  kart: number | string
  aciklama: string | null
  /** Kart tutarının banka kırılımı: banka → tutar. Girilmemişse null */
  kart_kirilimi: Record<string, number> | null
}

/** Kırılım satırı: ekranda sırası korunsun diye dizi, nesne değil */
type KirilimSatiri = { banka: string; tutar: string }

/** Kutulara yazılan metin: yer adı → { nakit, kart, kırılım } */
type Tutarlar = Record<
  string,
  { nakit: string; kart: string; kirilim: KirilimSatiri[] | null }
>

const BOS: Tutarlar[string] = { nakit: '', kart: '', kirilim: null }

/** Kırılım açıkken ilk gelen banka satırları */
const VARSAYILAN_BANKALAR = ['VAKIFBANK', 'HALKBANK']

/**
 * Hafta sonu kapalı olan yerler.
 *
 * Cumartesi–pazar yalnızca TORİK çalışıyor; diğerlerinde "veri girilmedi"
 * uyarısı çıkmasın, kapalı olduğu görünsün. Listede olmayan yeni bir yer
 * her gün açık sayılır — kapalıyı açık göstermek, gerçek bir eksiği
 * gizlemekten iyi.
 */
const HAFTA_SONU_KAPALI = ['GÖKSU', 'AKBABA']

/** Virgüllü metni sayıya çevirir; boş ise 0 */
function sayiya(metin: string): number {
  const n = Number((metin || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Günlük ciro defteri: satırlar gün, sütunlar yer.
 *
 * Bir günün bütün yerleri tek formda girilir; kayıt yer başına ayrı satır
 * olur ama kullanıcı gün gün düşündüğü için ekran da öyle duruyor.
 */
export function CiroEkrani({
  satirlar,
  yerler: gelenYerler,
}: {
  satirlar: CiroSatiri[]
  yerler: string[]
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const bugun = useBugun()
  const [tarih, setTarih] = useBugunTarihi()
  const [tutarlar, setTutarlar] = useState<Tutarlar>({})
  const [yeniYer, setYeniYer] = useState('')
  const [durum, setDurum] = useState<FinansDurumu>({})
  /** Tablodan "Düzelt" ile yüklenen gün — form başlığında yazar */
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [bas, setBas] = useState('')
  const [bit, setBit] = useState('')

  const yerler = useMemo(
    () => [...new Set([...gelenYerler, ...Object.keys(tutarlar)])],
    [gelenYerler, tutarlar],
  )

  // gün → yer → satır. Kaydı olmayan günler de listede: eksik gün boş
  // satır olarak durmazsa "girilmedi mi, kapalı mıydı" ayrımı yapılamıyor.
  const gunler = useMemo(() => {
    const m = new Map<string, Map<string, CiroSatiri>>()
    for (const s of satirlar) {
      if (bas && s.tarih < bas) continue
      if (bit && s.tarih > bit) continue
      const gun = m.get(s.tarih) ?? new Map<string, CiroSatiri>()
      gun.set(s.yer, s)
      m.set(s.tarih, gun)
    }

    // Aralık verilmediyse ilk kayıttan bugüne kadar
    const tarihler = [...m.keys()].sort()
    const ilk = bas || tarihler[0]
    const son = bit || (tarihler.length > 0 ? [tarihler.at(-1)!, bugun].sort().at(-1)! : bugun)
    if (ilk) {
      for (const g of gunAraligi(ilk, son)) {
        if (!m.has(g)) m.set(g, new Map())
      }
    }

    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [satirlar, bas, bit, bugun])

  /** alan: hangi rakam toplanacak — toplam, nakit ya da kart */
  type Alan = 'tutar' | 'nakit' | 'kart'
  const yerToplami = (yer: string, alan: Alan = 'tutar') =>
    gunler.reduce((t, [, gun]) => t + Number(gun.get(yer)?.[alan] ?? 0), 0)
  const gunToplami = (gun: Map<string, CiroSatiri>, alan: Alan = 'tutar') =>
    [...gun.values()].reduce((t, s) => t + Number(s[alan]), 0)
  const genelToplam = gunler.reduce((t, [, gun]) => t + gunToplami(gun), 0)
  const genelNakit = gunler.reduce((t, [, gun]) => t + gunToplami(gun, 'nakit'), 0)
  const genelKart = gunler.reduce((t, [, gun]) => t + gunToplami(gun, 'kart'), 0)

  // Dönemdeki kart hasılatının banka dağılımı; kırılımı olmayan satırların
  // kartı ayrı tutuluyor ki iki rakam toplamda kart ile aynı yeri bulsun.
  const { bankaToplamlari, kirilimsizKart } = useMemo(() => {
    const toplam = new Map<string, number>()
    let kirilimsiz = 0
    for (const [, gun] of gunler) {
      for (const s of gun.values()) {
        const k = s.kart_kirilimi
        if (k && Object.keys(k).length > 0) {
          for (const [banka, tutar] of Object.entries(k))
            toplam.set(banka, (toplam.get(banka) ?? 0) + Number(tutar))
        } else {
          kirilimsiz += Number(s.kart)
        }
      }
    }
    return {
      bankaToplamlari: [...toplam.entries()].sort((a, b) => b[1] - a[1]),
      kirilimsizKart: kirilimsiz,
    }
  }, [gunler])

  /**
   * Seçili günün kayıtlı değerlerini forma doldurur — düzeltmek için.
   *
   * Form tablonun üstünde durduğu için sayfa oraya kaydırılır: tıklayınca
   * ekranda hiçbir şey değişmiyor sanılıyordu.
   */
  /**
   * Seçilen günün kayıtlarını forma getirir.
   *
   * Tarih değiştirilince de çağrılıyor: form boş gelirse, o güne daha önce
   * girilmiş rakamların üstüne sıfır yazılıyordu. Kayıt yoksa form temizlenir
   * ve gün "düzenleniyor" sayılmaz.
   */
  function gunuGetir(gun: string) {
    const kayitlar = satirlar.filter((s) => s.tarih === gun)
    setTarih(gun)
    setTutarlar(
      Object.fromEntries(
        kayitlar.map((s) => [
          s.yer,
          {
            nakit: String(Number(s.nakit)).replace('.', ','),
            kart: String(Number(s.kart)).replace('.', ','),
            kirilim: s.kart_kirilimi
              ? Object.entries(s.kart_kirilimi).map(([banka, tutar]) => ({
                  banka,
                  tutar: String(Number(tutar)).replace('.', ','),
                }))
              : null,
          },
        ]),
      ),
    )
    setDuzenlenen(kayitlar.length > 0 ? gun : null)
    setDurum({})
  }

  function gunuYukle(gun: string) {
    gunuGetir(gun)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** Bir yerin kutularını değiştirir */
  function yeriDegistir(yer: string, yama: Partial<Tutarlar[string]>) {
    setTutarlar((eski) => ({ ...eski, [yer]: { ...(eski[yer] ?? BOS), ...yama } }))
  }

  /** Kırılım satırlarının toplamı */
  const kirilimToplami = (kirilim: KirilimSatiri[]) =>
    kirilim.reduce((t, k) => t + sayiya(k.tutar), 0)

  /** Daha önce kullanılmış banka adları — yazarken öneri olarak çıkar */
  const bankalar = useMemo(() => {
    const k = new Set(VARSAYILAN_BANKALAR)
    for (const s of satirlar) for (const b of Object.keys(s.kart_kirilimi ?? {})) k.add(b)
    return [...k].sort()
  }, [satirlar])

  function kaydet(e: React.FormEvent) {
    e.preventDefault()
    // Bir yer için iki kutudan biri doluysa o yer kaydedilir; boş olan 0 sayılır
    const girilenler = Object.entries(tutarlar).filter(
      ([, v]) =>
        v.nakit.trim() !== '' ||
        v.kart.trim() !== '' ||
        (v.kirilim?.some((k) => k.tutar.trim() !== '') ?? false),
    )
    if (girilenler.length === 0) {
      setDurum({ hata: 'En az bir yere nakit ya da kart tutarı yazın.' })
      return
    }

    // Kırılımda tutar yazılıp banka adı boş kalmış olabilir; kayda gitmeden
    // söylenmeli, yoksa o satır sessizce düşer ve toplam tutmaz.
    for (const [yer, v] of girilenler) {
      const eksik = (v.kirilim ?? []).some(
        (k) => k.tutar.trim() !== '' && k.banka.trim() === '',
      )
      if (eksik) {
        setDurum({ hata: `${yer}: banka adı boş bırakılmış bir kırılım satırı var.` })
        return
      }
    }

    baslat(async () => {
      for (const [yer, v] of girilenler) {
        const dolu = (v.kirilim ?? []).filter((k) => k.banka.trim() !== '')
        const sonuc = await ciroKaydet({
          tarih,
          yer,
          nakit: v.nakit.trim() || '0',
          kart: v.kart.trim() || '0',
          ...(dolu.length > 0
            ? { kart_kirilimi: JSON.stringify(dolu.map((k) => [k.banka, k.tutar || '0'])) }
            : {}),
        })
        if (sonuc.hata || sonuc.alanlar) {
          setDurum({ hata: sonuc.hata ?? 'Girilen değerlerde hata var.' })
          return
        }
      }
      setDurum({ basari: `${tarihBicim(tarih)} kaydedildi.` })
      setTutarlar({})
      setDuzenlenen(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Kırılım kutularındaki banka önerileri; tek liste yeter */}
      <datalist id="ciro-bankalar">
        {bankalar.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <form
        ref={formRef}
        onSubmit={kaydet}
        className={`kart space-y-3 p-4 ${
          duzenlenen ? 'ring-2 ring-amber-400' : ''
        }`}
      >
        {duzenlenen && (
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-amber-50 px-3 py-2">
            <span className="text-sm font-medium text-amber-900">
              {tarihBicim(duzenlenen)} düzenleniyor — kaydedince o günün rakamları
              değişir.
            </span>
            <button
              type="button"
              className="text-xs text-amber-900 underline"
              onClick={() => {
                setDuzenlenen(null)
                setTutarlar({})
              }}
            >
              Vazgeç
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="etiket text-xs" htmlFor="ciro-tarih">
              Tarih
            </label>
            <input
              id="ciro-tarih"
              type="date"
              value={tarih}
              /* Tarih değişince o günün kayıtları forma gelir: boş formla
                 kaydedip girilmiş rakamların üstüne yazmak kolaydı. */
              onChange={(e) => gunuGetir(e.target.value)}
              className="girdi !py-1.5"
            />
          </div>

          {/* Her yer için nakit ve kart ayrı; toplamı sistem hesaplıyor */}
          {yerler.map((yer) => {
            const v = tutarlar[yer] ?? BOS
            // Kırılım açıkken kart tutarı ondan hesaplanıyor; elle yazılan
            // rakamla kırılım birbirinden ayrı düşmesin.
            const kartTutari = v.kirilim ? kirilimToplami(v.kirilim) : sayiya(v.kart)
            const toplam = sayiya(v.nakit) + kartTutari
            return (
              <div key={yer} className="rounded-md border border-cizgi p-2">
                <span className="etiket mb-1 block text-xs">{yer}</span>
                <div className="flex gap-2">
                  <label className="flex flex-col text-[11px] text-solgun">
                    Nakit
                    <input
                      id={`ciro-${yer}-nakit`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={v.nakit}
                      onChange={(e) =>
                        setTutarlar({ ...tutarlar, [yer]: { ...v, nakit: e.target.value } })
                      }
                      className="girdi w-28 !py-1.5 text-right tabular-nums"
                    />
                  </label>
                  <label className="flex flex-col text-[11px] text-solgun">
                    Kredi kartı
                    <input
                      id={`ciro-${yer}-kart`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={v.kirilim ? para(kartTutari) : v.kart}
                      readOnly={!!v.kirilim}
                      title={v.kirilim ? 'Banka kırılımından hesaplanıyor' : undefined}
                      onChange={(e) => yeriDegistir(yer, { kart: e.target.value })}
                      className={`girdi w-28 !py-1.5 text-right tabular-nums ${
                        v.kirilim ? 'bg-slate-100 text-slate-600' : ''
                      }`}
                    />
                  </label>
                </div>

                {/* Banka kırılımı: poslar farklı bankalara bağlı olduğunda
                    hangisinden ne geldiği buradan giriliyor. İsteğe bağlı. */}
                {v.kirilim === null ? (
                  <button
                    type="button"
                    onClick={() =>
                      yeriDegistir(yer, {
                        kirilim: VARSAYILAN_BANKALAR.map((b) => ({ banka: b, tutar: '' })),
                      })
                    }
                    className="mt-1 text-[11px] text-vurgu hover:underline"
                  >
                    + Banka kırılımı
                  </button>
                ) : (
                  <div className="mt-1.5 space-y-1 rounded border border-cizgi bg-white/70 p-1.5">
                    {v.kirilim.map((k, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          list="ciro-bankalar"
                          value={k.banka}
                          placeholder="Banka"
                          onChange={(e) =>
                            yeriDegistir(yer, {
                              kirilim: v.kirilim!.map((x, j) =>
                                j === i ? { ...x, banka: e.target.value } : x,
                              ),
                            })
                          }
                          className="girdi w-24 !py-1 text-[11px]"
                        />
                        <input
                          inputMode="decimal"
                          value={k.tutar}
                          placeholder="0,00"
                          onChange={(e) =>
                            yeriDegistir(yer, {
                              kirilim: v.kirilim!.map((x, j) =>
                                j === i ? { ...x, tutar: e.target.value } : x,
                              ),
                            })
                          }
                          className="girdi w-20 !py-1 text-right text-[11px] tabular-nums"
                        />
                        <button
                          type="button"
                          aria-label={`${yer} kırılım satırını kaldır`}
                          onClick={() =>
                            yeriDegistir(yer, {
                              kirilim: v.kirilim!.filter((_, j) => j !== i),
                            })
                          }
                          className="px-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          yeriDegistir(yer, {
                            kirilim: [...v.kirilim!, { banka: '', tutar: '' }],
                          })
                        }
                        className="text-[11px] text-vurgu hover:underline"
                      >
                        + Banka
                      </button>
                      <button
                        type="button"
                        onClick={() => yeriDegistir(yer, { kirilim: null })}
                        className="ml-auto text-[11px] text-solgun hover:underline"
                      >
                        Kırılımı kaldır
                      </button>
                    </div>
                  </div>
                )}

                {toplam > 0 && (
                  <p className="mt-1 text-right text-xs font-semibold text-emerald-700">
                    {para(toplam)}
                  </p>
                )}
              </div>
            )
          })}

          <div>
            <label className="etiket text-xs" htmlFor="ciro-yeni-yer">
              Yeni yer
            </label>
            <div className="flex gap-2">
              <input
                id="ciro-yeni-yer"
                value={yeniYer}
                onChange={(e) => setYeniYer(e.target.value)}
                placeholder="Yer adı"
                className="girdi w-32 !py-1.5"
              />
              <button
                type="button"
                className="btn-ikincil !py-1.5"
                onClick={() => {
                  const ad = yeniYer.trim().toLocaleUpperCase('tr')
                  if (!ad) return
                  setTutarlar({ ...tutarlar, [ad]: tutarlar[ad] ?? BOS })
                  setYeniYer('')
                }}
              >
                Ekle
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Kaydediliyor…' : 'Günü Kaydet'}
          </button>
          {durum.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
          {durum.basari && !bekliyor && (
            <span className="text-sm text-emerald-700">{durum.basari}</span>
          )}
        </div>
      </form>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket text-xs" htmlFor="ciro-bas">
            Başlangıç
          </label>
          <input
            id="ciro-bas"
            type="date"
            value={bas}
            onChange={(e) => setBas(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="ciro-bit">
            Bitiş
          </label>
          <input
            id="ciro-bit"
            type="date"
            value={bit}
            onChange={(e) => setBit(e.target.value)}
            className="girdi !py-1.5"
          />
        </div>
        {(bas || bit) && (
          <button
            type="button"
            className="btn-ikincil !py-1.5"
            onClick={() => {
              setBas('')
              setBit('')
            }}
          >
            Tüm tarihler
          </button>
        )}
        {/* Dönemin nakit / kart kırılımı ve toplamı */}
        <div className="ml-auto flex flex-wrap gap-6 text-right">
          <div>
            <p className="text-xs font-semibold tracking-wide text-solgun uppercase">Nakit</p>
            <p className="text-xl font-bold tabular-nums">{para(genelNakit)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
              Kredi kartı
            </p>
            <p className="text-xl font-bold tabular-nums text-indigo-700">{para(genelKart)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
              Dönem toplamı
            </p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">
              {para(genelToplam)}
            </p>
          </div>
        </div>
      </div>

      {/* Banka bazında kart toplamı: hangi postan ne geldiği. Kırılım
          girilmemiş günlerin kartı "banka belirtilmemiş" altında durur,
          yoksa toplam kart rakamıyla tutmuyormuş gibi görünür. */}
      {bankaToplamlari.length > 0 && (
        <div className="kart p-4">
          <p className="mb-2 text-xs font-semibold tracking-wide text-solgun uppercase">
            Banka bazında kredi kartı
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {bankaToplamlari.map(([banka, tutar]) => (
              <div key={banka}>
                <p className="text-xs text-solgun">{banka}</p>
                <p className="font-semibold tabular-nums">{para(tutar)}</p>
              </div>
            ))}
            {kirilimsizKart > 0 && (
              <div>
                <p className="text-xs text-solgun">banka belirtilmemiş</p>
                <p className="font-semibold text-solgun tabular-nums">{para(kirilimsizKart)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Tarih</th>
              {yerler.map((y) => (
                <th key={y} className="text-right">
                  {y}
                </th>
              ))}
              <th className="text-right">Gün Toplamı</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gunler.map(([gun, kayitlar]) => (
              <tr key={gun} className={haftaSonuMu(gun) ? 'bg-slate-50/70' : undefined}>
                <td className="whitespace-nowrap">
                  {tarihBicim(gun)}
                  <span className="block text-xs text-solgun">{gunAdi(gun)}</span>
                </td>
                {yerler.map((y) => {
                  const s = kayitlar.get(y)
                  // Hafta sonu kapalı yerde eksik veri uyarısı anlamsız
                  const kapali = haftaSonuMu(gun) && HAFTA_SONU_KAPALI.includes(y)
                  return (
                    <td key={y} className="text-right tabular-nums">
                      {s ? (
                        <>
                          {para(s.tutar)}
                          {/* Ayrımdan önceki kayıtlarda kırılım yok, satır kalabalık olmasın */}
                          {Number(s.nakit) + Number(s.kart) > 0 && (
                            <span className="block text-xs text-solgun">
                              {para(s.nakit)} nakit · {para(s.kart)} kart
                            </span>
                          )}
                          {/* Banka kırılımı girilmişse hangi bankadan ne
                              geldiği satırın altında durur */}
                          {s.kart_kirilimi &&
                            Object.entries(s.kart_kirilimi).map(([banka, tutar]) => (
                              <span key={banka} className="block text-[11px] text-indigo-700">
                                {banka} {para(tutar)}
                              </span>
                            ))}
                        </>
                      ) : kapali ? (
                        <span className="text-xs text-solgun">kapalı</span>
                      ) : (
                        <span className="text-xs text-amber-700">veri girilmedi</span>
                      )}
                    </td>
                  )
                })}
                <td className="text-right font-semibold tabular-nums text-emerald-700">
                  {kayitlar.size === 0 ? (
                    <span className="text-xs font-normal text-amber-700">veri girilmedi</span>
                  ) : (
                    <>
                      {para(gunToplami(kayitlar))}
                      {gunToplami(kayitlar, 'nakit') + gunToplami(kayitlar, 'kart') > 0 && (
                        <span className="block text-xs font-normal text-solgun">
                          {para(gunToplami(kayitlar, 'nakit'))} nakit ·{' '}
                          {para(gunToplami(kayitlar, 'kart'))} kart
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="text-xs text-vurgu hover:underline"
                    onClick={() => gunuYukle(gun)}
                  >
                    {kayitlar.size === 0 ? 'Gir' : 'Düzelt'}
                  </button>
                  <button
                    type="button"
                    className={`ml-3 text-xs text-red-600 hover:underline ${
                      kayitlar.size === 0 ? 'hidden' : ''
                    }`}
                    disabled={bekliyor}
                    onClick={() => {
                      if (!confirm(`${tarihBicim(gun)} kayıtları silinsin mi?`)) return
                      baslat(async () => {
                        for (const s of kayitlar.values()) {
                          const sonuc = await ciroSil(s.id)
                          if (sonuc.hata) {
                            setDurum({ hata: sonuc.hata })
                            return
                          }
                        }
                        router.refresh()
                      })
                    }}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {gunler.length === 0 && (
              <tr>
                <td colSpan={yerler.length + 3} className="py-8 text-center text-solgun">
                  Henüz ciro girilmemiş. Yukarıdan bir günün rakamlarını yazıp kaydedin.
                </td>
              </tr>
            )}
          </tbody>
          {gunler.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2">Toplam</td>
                {yerler.map((y) => (
                  <td key={y} className="px-3 py-2 text-right tabular-nums">
                    {para(yerToplami(y))}
                    {yerToplami(y, 'nakit') + yerToplami(y, 'kart') > 0 && (
                      <span className="block text-xs font-normal text-solgun">
                        {para(yerToplami(y, 'nakit'))} nakit · {para(yerToplami(y, 'kart'))} kart
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                  {para(genelToplam)}
                  {genelNakit + genelKart > 0 && (
                    <span className="block text-xs font-normal text-solgun">
                      {para(genelNakit)} nakit · {para(genelKart)} kart
                    </span>
                  )}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
