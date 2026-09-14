'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useMemo, useState, useTransition } from 'react'

import { aramaNormalle } from '@/lib/arama'
import type { EslesmeTuru } from '@/lib/ekstre'
import { para, tarih as tarihBicim } from '@/lib/format'
import { mukerrerAnahtarlar, tahsilatAnahtari } from '@/lib/tahsilat-mukerrer'

import {
  ekstreCozumle,
  tahsilatlariKaydet,
  type CozumlemeDurumu,
  type KayitDurumu,
} from './actions'
import { OgrenciArama } from './OgrenciArama'

export type OgrenciSecenegi = {
  id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kardes_grup_id: string | null
  kalan: number
  veli_adi: string | null
  veli2_adi: string | null
}

/** Bir ekstre satırının tek bir öğrenciye düşen parçası */
type Pay = { studentId: string; tutar: string }

/** Seçili öğrencinin kardeşi ve neden kardeş sayıldığı */
type Kardes = { o: OgrenciSecenegi; neden: 'bagli' | 'veli' }

/** "1.234,56" ya da "1234.56" → 1234.56 */
function sayiOku(metin: string): number {
  const t = metin.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const s = Number(t)
  return Number.isFinite(s) ? s : NaN
}

const KURUS = 0.005
const kurus = (n: number) => Math.round(n * 100) / 100

/** Öneri listesinde öğrencinin yanında yazan gerekçe */
const ESLESME_NOTU: Record<EslesmeTuru, string> = {
  'veli-ogrenci': 'veli ve öğrenci adı tuttu',
  ogrenci: 'açıklamada adı geçiyor',
  veli: 'veli adı tuttu',
}

/** İki kelimeden kısa veli adı kardeş saymak için kullanılmaz: yanlış eşleşir. */
function veliAnahtari(ad: string | null): string {
  const n = ad ? aramaNormalle(ad) : ''
  return n.split(' ').length >= 2 ? n : ''
}

export function EkstreEkrani({ ogrenciler }: { ogrenciler: OgrenciSecenegi[] }) {
  const [durum, cozumle, cozumleniyor] = useActionState(ekstreCozumle, {} as CozumlemeDurumu)
  const [kayit, setKayit] = useState<KayitDurumu>({})
  const [gonderiliyor, basla] = useTransition()
  const router = useRouter()

  const [secim, setSecim] = useState<{
    anahtar: string
    paylar: Record<number, Pay[]>
    isaretli: Record<number, boolean>
    /** Mükerrer uyarısına rağmen aktarılması onaylanan satırlar */
    onayli: Record<number, boolean>
  }>({ anahtar: '', paylar: {}, isaretli: {}, onayli: {} })

  const ogrenciHarita = useMemo(() => new Map(ogrenciler.map((o) => [o.id, o])), [ogrenciler])

  const satirlar = durum.satirlar ?? []
  const anahtar = durum.satirlar ? `${durum.dosyaAdi}|${satirlar.length}` : ''

  /**
   * Sistemde zaten duran tahsilatlar (öğrenci|gün|tutar).
   *
   * Elle girilmiş bir ödeme ekstreden ikinci kez aktarılabiliyordu: elle
   * girişte banka fiş numarası olmadığı için fiş kontrolü bunu görmüyor.
   */
  const varOlanlar = useMemo(
    () => mukerrerAnahtarlar(durum.mevcutTahsilatlar ?? []),
    [durum.mevcutTahsilatlar],
  )

  if (anahtar && secim.anahtar !== anahtar) {
    const paylar: Record<number, Pay[]> = {}
    const isaretli: Record<number, boolean> = {}
    satirlar.forEach((s, i) => {
      const adlaEslesen = s.adaylar.filter((a) => a.eslesme !== 'veli')
      let p: Pay[]
      if (s.adaylar.length === 1) {
        p = [{ studentId: s.adaylar[0].studentId, tutar: String(s.tutar) }]
      } else if (adlaEslesen.length > 1) {
        // Açıklamada birden çok öğrencinin adı geçiyor (bir veli, iki çocuk,
        // tek havale): tutar eşit bölünerek önerilir; kuruş farkı ilkine.
        const n = adlaEslesen.length
        const pay = Math.floor((s.tutar / n) * 100) / 100
        const ilk = kurus(s.tutar - pay * (n - 1))
        p = adlaEslesen.map((a, k) => ({ studentId: a.studentId, tutar: String(k === 0 ? ilk : pay) }))
      } else {
        p = [{ studentId: '', tutar: String(s.tutar) }]
      }
      paylar[i] = p

      // Kendiliğinden yalnız tek öğrenciye giden, mükerrer görünmeyen satır
      // işaretlenir. Bölünmüş öneriyi kullanıcı görüp işaretlesin.
      const tek = p.length === 1 ? p[0].studentId : ''
      const mukerrerMi = tek !== '' && varOlanlar.has(tahsilatAnahtari(tek, s.tarih, s.tutar))
      isaretli[i] = tek !== '' && !s.zatenVar && !mukerrerMi
    })
    setSecim({ anahtar, paylar, isaretli, onayli: {} })
    setKayit({})
  }

  function paylariDegistir(i: number, yeni: Pay[]) {
    setSecim((o) => ({ ...o, paylar: { ...o.paylar, [i]: yeni } }))
  }

  /**
   * Satırda seçili öğrencilerin kardeşleri (henüz bu satıra eklenmemiş olanlar).
   *
   * İki yoldan: sistemde kardeş olarak bağlı olanlar ya da aynı veli adıyla
   * kayıtlı olanlar. İkincisi bağ kurulmamış kardeşleri de yakalar — veli iki
   * çocuğu için tek havale göndermiş olabilir, ekranda gözden kaçmasın.
   */
  function kardesleriBul(paylar: Pay[]): Kardes[] {
    const secililer = paylar
      .map((p) => (p.studentId ? ogrenciHarita.get(p.studentId) : undefined))
      .filter((o): o is OgrenciSecenegi => !!o)
    if (secililer.length === 0) return []

    const seciliIdler = new Set(secililer.map((o) => o.id))
    const gruplar = new Set(secililer.map((o) => o.kardes_grup_id).filter(Boolean))
    const veliler = new Set(
      secililer.flatMap((o) => [veliAnahtari(o.veli_adi), veliAnahtari(o.veli2_adi)]).filter(Boolean),
    )

    const sonuc: Kardes[] = []
    for (const o of ogrenciler) {
      if (seciliIdler.has(o.id)) continue
      if (o.kardes_grup_id && gruplar.has(o.kardes_grup_id)) {
        sonuc.push({ o, neden: 'bagli' })
      } else if ([veliAnahtari(o.veli_adi), veliAnahtari(o.veli2_adi)].some((v) => v && veliler.has(v))) {
        sonuc.push({ o, neden: 'veli' })
      }
    }
    return sonuc
  }

  /**
   * Ödemeyi kardeşe böler: satırdaki en büyük pay bölünür. Kardeşin borcu
   * varsa borcu kadarı ona ayrılır, yoksa pay yarı yarıya bölünür.
   */
  function kardeseBol(i: number, kardes: OgrenciSecenegi) {
    const s = satirlar[i]
    const paylar = secim.paylar[i] ?? []
    if (!s || paylar.length === 0) return

    let k = 0
    paylar.forEach((p, x) => {
      if ((sayiOku(p.tutar) || 0) > (sayiOku(paylar[k].tutar) || 0)) k = x
    })
    const kaynak = sayiOku(paylar[k].tutar) || s.tutar
    const borc = Math.max(0, -kardes.kalan)
    const kardesPay = borc > 0 ? Math.min(borc, kaynak) : kaynak / 2

    const yeni = [...paylar]
    yeni[k] = { ...yeni[k], tutar: String(kurus(kaynak - kardesPay)) }
    yeni.push({ studentId: kardes.id, tutar: String(kurus(kardesPay)) })
    paylariDegistir(i, yeni)
  }

  /**
   * Satır aktarılabilir mi?
   *
   * Toplamın ödemenin tamamına eşit olması ŞART DEĞİL: bir veli aynı havaleyle
   * hem yemekhane hem kantin ücretini yatırabiliyor, o yüzden tutar elle
   * değiştirilebilir ve eksik dağıtım yalnızca uyarı üretir.
   */
  function gecerliMi(i: number): boolean {
    const paylar = secim.paylar[i] ?? []
    if (paylar.length === 0) return false
    if (paylar.some((p) => !p.studentId)) return false
    const kimlikler = paylar.map((p) => p.studentId)
    if (new Set(kimlikler).size !== kimlikler.length) return false
    return paylar.every((p) => {
      const t = sayiOku(p.tutar)
      return Number.isFinite(t) && t > 0
    })
  }

  function dagitilanTutar(i: number): number {
    return (secim.paylar[i] ?? []).reduce((t, p) => {
      const v = sayiOku(p.tutar)
      return t + (Number.isFinite(v) ? v : 0)
    }, 0)
  }

  /** Bu satırdaki paylardan hangileri sistemde zaten duruyor? */
  function mukerrerPaylar(i: number): Pay[] {
    const s = satirlar[i]
    if (!s) return []
    return (secim.paylar[i] ?? []).filter((p) => {
      const t = sayiOku(p.tutar)
      if (!p.studentId || !Number.isFinite(t)) return false
      return varOlanlar.has(tahsilatAnahtari(p.studentId, s.tarih, t))
    })
  }

  /** Uyarı var ve kullanıcı onaylamadıysa satır aktarılmaz. */
  function engelliMi(i: number): boolean {
    return mukerrerPaylar(i).length > 0 && !secim.onayli[i]
  }

  /**
   * Gönderen sütununda ne yazsın?
   *
   * Bankanın gönderen alanı veli adının ardına öğrenci adını ve "YEMEK" gibi
   * açıklamaları ekliyor. Eşleştirici her aday için temiz bir ad hazırlıyor:
   * veli tuttuysa kayıtlı veli adı, tutmadıysa gönderen metninden öğrencinin
   * adı çıkarılmış hâli — çocuğun adı gönderen olarak görünmesin.
   */
  function gonderenAdi(i: number): string {
    const s = satirlar[i]
    if (!s) return '—'

    const secili = (secim.paylar[i] ?? []).find((p) => p.studentId)?.studentId
    const seciliAday = secili ? s.adaylar.find((a) => a.studentId === secili) : undefined
    const eslesen = seciliAday ?? s.adaylar[0]

    return eslesen?.gonderenAdi || s.gonderen || '—'
  }

  const aktarilacak = satirlar
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => secim.isaretli[i] && !s.zatenVar && gecerliMi(i) && !engelliMi(i))

  const toplam = aktarilacak.reduce((t, { i }) => t + dagitilanTutar(i), 0)
  const kalemSayisi = aktarilacak.reduce((t, { i }) => t + (secim.paylar[i]?.length ?? 0), 0)
  const eksik = satirlar.filter((s, i) => !s.zatenVar && !gecerliMi(i)).length
  const kismi = aktarilacak.filter(({ s, i }) => Math.abs(dagitilanTutar(i) - s.tutar) >= KURUS)
    .length
  const mukerrer = satirlar.filter((s) => s.zatenVar).length
  const ayniOdeme = satirlar.filter((s, i) => !s.zatenVar && mukerrerPaylar(i).length > 0).length
  const kardesli = satirlar.filter((s, i) => !s.zatenVar && kardesleriBul(secim.paylar[i] ?? []).length > 0).length

  function aktar() {
    basla(async () => {
      const girdiler = aktarilacak.flatMap(({ s, i }) =>
        (secim.paylar[i] ?? []).map((p) => ({
          studentId: p.studentId,
          tarih: s.tarih,
          tutar: sayiOku(p.tutar),
          fisNo: s.fisNo,
          aciklama: s.aciklama,
          onay: secim.onayli[i] === true,
        })),
      )

      // Dosyanın kapsadığı tarih aralığı kayıt izine yazılır: listede
      // "şu tarihler arası ekstre, şu saatte aktarıldı" yazabilmek için.
      const tarihler = satirlar.map((s) => s.tarih).sort()
      const sonuc = await tahsilatlariKaydet(girdiler, {
        dosyaAdi: durum.dosyaAdi ?? 'ekstre',
        satirSayisi: satirlar.length,
        ekstreBas: tarihler[0],
        ekstreBit: tarihler[tarihler.length - 1],
      })
      setKayit(sonuc)
      if (sonuc.eklenen && sonuc.eklenen > 0) {
        setSecim((o) => ({
          ...o,
          isaretli: Object.fromEntries(Object.keys(o.isaretli).map((k) => [k, false])),
        }))
      }
      // Aktarım geçmişi sunucuda üretiliyor; yeni satır görünsün.
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <form action={cozumle} className="kart flex flex-wrap items-end gap-3 p-4">
        <div className="grow">
          <label className="etiket">Banka ekstresi (Excel)</label>
          <input
            type="file"
            name="dosya"
            accept=".xlsx"
            className="girdi file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5"
            required
          />
        </div>
        <button className="btn-birincil" disabled={cozumleniyor}>
          {cozumleniyor ? 'Okunuyor…' : 'Dosyayı Oku'}
        </button>
      </form>

      {durum.hata && <p className="hata">{durum.hata}</p>}

      {satirlar.length > 0 && (
        <>
          <div className="kart flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span>
              <strong>{satirlar.length}</strong> para girişi okundu
            </span>
            {eksik > 0 && <span className="text-amber-700">{eksik} satırda öğrenci seçilmedi</span>}
            {kismi > 0 && (
              <span className="text-amber-700">{kismi} satırda tutarın tamamı aktarılmıyor</span>
            )}
            {kardesli > 0 && (
              <span className="text-violet-700">{kardesli} satırda öğrencinin kardeşi var</span>
            )}
            {mukerrer > 0 && (
              <span className="text-solgun">{mukerrer} satır daha önce aktarılmış</span>
            )}
            {ayniOdeme > 0 && (
              <span className="font-medium text-amber-700">
                {ayniOdeme} satırda aynı ödeme zaten girilmiş
              </span>
            )}
            <span className="ml-auto">
              Aktarılacak: <strong>{kalemSayisi}</strong> kayıt · <strong>{para(toplam)}</strong>
            </span>
          </div>

          <div className="kart overflow-x-auto">
            <table className="tablo">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Tarih</th>
                  <th>Gönderen</th>
                  <th className="min-w-[30rem]">Öğrenci ve aktarılacak tutar</th>
                  <th className="text-right">Ekstre tutarı</th>
                  <th>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => {
                  const paylar = secim.paylar[i] ?? []
                  const dagitilan = dagitilanTutar(i)
                  const fark = s.tutar - dagitilan
                  const tamam = gecerliMi(i)
                  const ayniOlanlar = mukerrerPaylar(i)
                  const engelli = engelliMi(i)
                  const adlaEslesenSayisi = s.adaylar.filter((a) => a.eslesme !== 'veli').length
                  const kardesler = s.zatenVar ? [] : kardesleriBul(paylar)

                  // Öneriler: eşleşen adaylar, sonra seçili öğrencinin kardeşleri
                  const oneriler = [
                    ...s.adaylar.map((a) => ({
                      id: a.studentId,
                      not: ESLESME_NOTU[a.eslesme] + (a.kaynak === 'veli2' ? ' · 2. veli' : ''),
                    })),
                    ...kardesler
                      .filter((x) => !s.adaylar.some((a) => a.studentId === x.o.id))
                      .map((x) => ({ id: x.o.id, not: 'kardeşi' })),
                  ]

                  return (
                    <tr
                      key={`${s.fisNo}-${i}`}
                      className={
                        s.zatenVar
                          ? 'opacity-50'
                          : ayniOlanlar.length > 0
                            ? 'bg-amber-50'
                            : undefined
                      }
                    >
                      <td className="align-top">
                        <input
                          type="checkbox"
                          checked={secim.isaretli[i] ?? false}
                          disabled={s.zatenVar || !tamam || engelli}
                          onChange={(e) =>
                            setSecim((o) => ({
                              ...o,
                              isaretli: { ...o.isaretli, [i]: e.target.checked },
                            }))
                          }
                        />
                      </td>
                      <td className="align-top whitespace-nowrap">{tarihBicim(s.tarih)}</td>
                      <td className="align-top whitespace-nowrap font-medium">
                        {gonderenAdi(i)}
                      </td>

                      <td className="align-top">
                        {s.zatenVar ? (
                          <span className="rozet bg-gray-100 text-gray-700">aktarılmış</span>
                        ) : (
                          <div className="space-y-2">
                            {adlaEslesenSayisi > 1 && paylar.length > 1 && (
                              <p className="text-xs text-violet-800">
                                Açıklamada {adlaEslesenSayisi} öğrencinin adı geçiyor; tutar eşit
                                bölündü. Kontrol edip işaretleyin.
                              </p>
                            )}

                            {paylar.map((p, k) => {
                              const secili = p.studentId ? ogrenciHarita.get(p.studentId) : null
                              return (
                                <div key={k} className="flex flex-wrap items-center gap-2">
                                  <OgrenciArama
                                    secili={p.studentId}
                                    ogrenciler={ogrenciler}
                                    oneriler={oneriler}
                                    onSec={(id) => {
                                      const yeni = [...paylar]
                                      yeni[k] = { ...yeni[k], studentId: id }
                                      paylariDegistir(i, yeni)
                                    }}
                                  />

                                  {/* Tutar her zaman elle değiştirilebilir */}
                                  <input
                                    value={p.tutar}
                                    onChange={(e) => {
                                      const yeni = [...paylar]
                                      yeni[k] = { ...yeni[k], tutar: e.target.value }
                                      paylariDegistir(i, yeni)
                                    }}
                                    inputMode="decimal"
                                    className="girdi !py-1 w-28 text-right tabular-nums"
                                    aria-label="Bu öğrenciye aktarılacak tutar"
                                  />

                                  {secili && (
                                    <span
                                      className={`text-xs whitespace-nowrap ${
                                        secili.kalan < 0 ? 'text-red-600' : 'text-solgun'
                                      }`}
                                    >
                                      bakiye {para(secili.kalan)}
                                    </span>
                                  )}

                                  {paylar.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        paylariDegistir(
                                          i,
                                          paylar.filter((_, x) => x !== k),
                                        )
                                      }
                                      className="rounded px-1.5 text-xs text-red-600 hover:bg-red-50"
                                      aria-label="Bu satırı kaldır"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              )
                            })}

                            {/* Kardeşler: ödeme onlar için de olabilir, gözden kaçmasın */}
                            {kardesler.length > 0 && (
                              <div className="rounded border border-violet-200 bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
                                <p className="font-semibold">
                                  {kardesler.length === 1
                                    ? 'Kardeşi de kayıtlı'
                                    : `${kardesler.length} kardeşi de kayıtlı`}{' '}
                                  — ödeme onlar için de olabilir:
                                </p>
                                <ul className="mt-1 space-y-1">
                                  {kardesler.map(({ o, neden }) => (
                                    <li key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="font-medium">
                                        {o.ogrenci_no} · {o.ad_soyad}
                                        {o.sinif ? ` (${o.sinif})` : ''}
                                      </span>
                                      <span
                                        className={`tabular-nums ${o.kalan < 0 ? 'text-red-700' : 'text-violet-700'}`}
                                      >
                                        bakiye {para(o.kalan)}
                                      </span>
                                      {neden === 'veli' && (
                                        <span className="text-violet-600">
                                          aynı veli · kardeş bağı yok
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => kardeseBol(i, o)}
                                        className="rounded border border-violet-300 bg-white px-2 py-0.5 font-medium hover:bg-violet-100"
                                        title="Kardeşin borcu varsa borcu kadarı, yoksa yarısı ona ayrılır"
                                      >
                                        + ödemeyi böl
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Math.abs(fark) >= KURUS && (
                              <p className="text-xs text-amber-700">
                                {fark > 0
                                  ? `${para(fark)} aktarılmayacak — kasıtlıysa sorun yok.`
                                  : `Ekstre tutarından ${para(-fark)} fazla giriliyor.`}
                              </p>
                            )}

                            {/* Elle girilmiş ödeme ekstreden ikinci kez
                                işlenmesin: bakiye sessizce şişiyordu. */}
                            {ayniOlanlar.length > 0 && (
                              <div className="rounded border border-amber-300 bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
                                <p className="font-semibold">
                                  Bu ödeme zaten girilmiş görünüyor.
                                </p>
                                <ul className="mt-0.5">
                                  {ayniOlanlar.map((p, x) => (
                                    <li key={x}>
                                      {ogrenciHarita.get(p.studentId)?.ad_soyad ?? '—'} ·{' '}
                                      {tarihBicim(s.tarih)} · {para(sayiOku(p.tutar))}
                                    </li>
                                  ))}
                                </ul>
                                {secim.onayli[i] ? (
                                  <p className="mt-1 font-semibold">
                                    Onaylandı — yine de aktarılacak.
                                  </p>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSecim((o) => ({
                                        ...o,
                                        onayli: { ...o.onayli, [i]: true },
                                        isaretli: { ...o.isaretli, [i]: true },
                                      }))
                                    }
                                    className="mt-1 rounded border border-amber-400 bg-white px-2 py-0.5 font-medium hover:bg-amber-50"
                                  >
                                    Ayrı bir ödeme, yine de aktar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="align-top text-right tabular-nums whitespace-nowrap">
                        {para(s.tutar)}
                      </td>
                      <td className="align-top text-xs text-solgun">{s.aciklama}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={aktar}
              className="btn-birincil"
              disabled={gonderiliyor || aktarilacak.length === 0}
            >
              {gonderiliyor ? 'Aktarılıyor…' : `${kalemSayisi} Tahsilatı Aktar (${para(toplam)})`}
            </button>
            {kayit.basari && (
              <span className="text-sm font-medium text-emerald-700">{kayit.basari}</span>
            )}
            {kayit.hata && <span className="hata">{kayit.hata}</span>}
            {kayit.eklenen ? (
              <Link href="/reports/tahsilat" className="text-sm text-vurgu hover:underline">
                Tahsilat raporunu aç →
              </Link>
            ) : null}
          </div>

          <p className="text-xs text-solgun">
            Öneriler çift taraflı: gönderen <strong>kayıtlı veli</strong> mi ve açıklamada{' '}
            <strong>öğrencinin adı</strong> geçiyor mu, ikisine de bakılır; ikisi birden
            tutan öğrenci en üstte önerilir. Öğrenci kutusuna ad, numara ya da sınıf yazarak
            arayabilirsiniz. Seçilen öğrencinin <strong>kardeşi</strong> varsa (kardeş bağı
            ya da aynı veli) mor kutuda listelenir; ödemeyi bölmek için{' '}
            <strong>+ ödemeyi böl</strong>. Aktarılacak tutar her satırda elle
            değiştirilebilir. Aktarılan kayıtlar <strong>havale</strong> olarak işlenir ve
            banka fiş numarası saklanır.
          </p>
        </>
      )}
    </div>
  )
}
