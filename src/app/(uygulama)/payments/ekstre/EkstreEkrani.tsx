'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState, useTransition } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'

import {
  ekstreCozumle,
  tahsilatlariKaydet,
  type CozumlemeDurumu,
  type KayitDurumu,
} from './actions'

export type OgrenciSecenegi = {
  id: string
  ogrenci_no: string
  ad_soyad: string
  sinif: string | null
  kardes_grup_id: string | null
  kalan: number
}

/** Bir ekstre satırının tek bir öğrenciye düşen parçası */
type Pay = { studentId: string; tutar: string }

/** "1.234,56" ya da "1234.56" → 1234.56 */
function sayiOku(metin: string): number {
  const t = metin.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const s = Number(t)
  return Number.isFinite(s) ? s : NaN
}

const KURUS = 0.005

export function EkstreEkrani({ ogrenciler }: { ogrenciler: OgrenciSecenegi[] }) {
  const [durum, cozumle, cozumleniyor] = useActionState(ekstreCozumle, {} as CozumlemeDurumu)
  const [kayit, setKayit] = useState<KayitDurumu>({})
  const [gonderiliyor, basla] = useTransition()

  const [secim, setSecim] = useState<{
    anahtar: string
    paylar: Record<number, Pay[]>
    isaretli: Record<number, boolean>
  }>({ anahtar: '', paylar: {}, isaretli: {} })

  const ogrenciHarita = useMemo(() => new Map(ogrenciler.map((o) => [o.id, o])), [ogrenciler])

  const satirlar = durum.satirlar ?? []
  const anahtar = durum.satirlar ? `${durum.dosyaAdi}|${satirlar.length}` : ''

  if (anahtar && secim.anahtar !== anahtar) {
    const paylar: Record<number, Pay[]> = {}
    const isaretli: Record<number, boolean> = {}
    satirlar.forEach((s, i) => {
      const tek = s.adaylar.length === 1 ? s.adaylar[0].studentId : ''
      paylar[i] = [{ studentId: tek, tutar: String(s.tutar) }]
      isaretli[i] = tek !== '' && !s.zatenVar
    })
    setSecim({ anahtar, paylar, isaretli })
    setKayit({})
  }

  function paylariDegistir(i: number, yeni: Pay[]) {
    setSecim((o) => ({ ...o, paylar: { ...o.paylar, [i]: yeni } }))
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

  const aktarilacak = satirlar
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => secim.isaretli[i] && !s.zatenVar && gecerliMi(i))

  const toplam = aktarilacak.reduce((t, { i }) => t + dagitilanTutar(i), 0)
  const kalemSayisi = aktarilacak.reduce((t, { i }) => t + (secim.paylar[i]?.length ?? 0), 0)
  const eksik = satirlar.filter((s, i) => !s.zatenVar && !gecerliMi(i)).length
  const kismi = aktarilacak.filter(({ s, i }) => Math.abs(dagitilanTutar(i) - s.tutar) >= KURUS)
    .length
  const mukerrer = satirlar.filter((s) => s.zatenVar).length

  function aktar() {
    basla(async () => {
      const girdiler = aktarilacak.flatMap(({ s, i }) =>
        (secim.paylar[i] ?? []).map((p) => ({
          studentId: p.studentId,
          tarih: s.tarih,
          tutar: sayiOku(p.tutar),
          fisNo: s.fisNo,
          aciklama: s.aciklama,
        })),
      )
      const sonuc = await tahsilatlariKaydet(girdiler)
      setKayit(sonuc)
      if (sonuc.eklenen && sonuc.eklenen > 0) {
        setSecim((o) => ({
          ...o,
          isaretli: Object.fromEntries(Object.keys(o.isaretli).map((k) => [k, false])),
        }))
      }
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
            {mukerrer > 0 && (
              <span className="text-solgun">{mukerrer} satır daha önce aktarılmış</span>
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
                  <th className="min-w-96">Öğrenci ve aktarılacak tutar</th>
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

                  return (
                    <tr key={`${s.fisNo}-${i}`} className={s.zatenVar ? 'opacity-50' : undefined}>
                      <td className="align-top">
                        <input
                          type="checkbox"
                          checked={secim.isaretli[i] ?? false}
                          disabled={s.zatenVar || !tamam}
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
                        {s.gonderen || '—'}
                      </td>

                      <td className="align-top">
                        {s.zatenVar ? (
                          <span className="rozet bg-gray-100 text-gray-700">aktarılmış</span>
                        ) : (
                          <div className="space-y-2">
                            {paylar.map((p, k) => {
                              const secili = p.studentId ? ogrenciHarita.get(p.studentId) : null
                              // Bölme yalnızca kardeşi tanımlı öğrencilerde açılır;
                              // diğerlerinde ekran gereksiz düğmeyle dolmasın.
                              const kardesler = secili?.kardes_grup_id
                                ? ogrenciler.filter(
                                    (o) =>
                                      o.kardes_grup_id === secili.kardes_grup_id &&
                                      o.id !== secili.id &&
                                      !paylar.some((x) => x.studentId === o.id),
                                  )
                                : []

                              return (
                                <div key={k} className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={p.studentId}
                                    onChange={(e) => {
                                      const yeni = [...paylar]
                                      yeni[k] = { ...yeni[k], studentId: e.target.value }
                                      paylariDegistir(i, yeni)
                                    }}
                                    className="girdi !py-1 min-w-56"
                                  >
                                    <option value="">— seçiniz —</option>
                                    {s.adaylar.length > 0 && (
                                      <optgroup label="Veli adına göre önerilen">
                                        {s.adaylar.map((a) => (
                                          <option key={a.studentId} value={a.studentId}>
                                            {a.ogrenciNo} · {a.adSoyad}
                                            {a.sinif ? ` (${a.sinif})` : ''}
                                            {a.kaynak === 'veli2' ? ' — 2. veli' : ''}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    <optgroup label="Tüm öğrenciler">
                                      {ogrenciler.map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.ogrenci_no} · {o.ad_soyad}
                                          {o.sinif ? ` (${o.sinif})` : ''}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>

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

                                  {kardesler.map((kardes) => (
                                    <button
                                      key={kardes.id}
                                      type="button"
                                      onClick={() => {
                                        const borc = Math.min(Math.max(0, -kardes.kalan), s.tutar)
                                        const kardesPay = borc > 0 ? borc : s.tutar / 2
                                        const yeni = [...paylar]
                                        yeni[k] = {
                                          ...yeni[k],
                                          tutar: String(
                                            Math.round((s.tutar - kardesPay) * 100) / 100,
                                          ),
                                        }
                                        yeni.push({
                                          studentId: kardes.id,
                                          tutar: String(Math.round(kardesPay * 100) / 100),
                                        })
                                        paylariDegistir(i, yeni)
                                      }}
                                      className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-800 hover:bg-violet-100"
                                      title="Kardeşiyle böl: kardeşin borcu kadarı ona ayrılır"
                                    >
                                      + kardeşi ({kardes.ad_soyad})
                                    </button>
                                  ))}

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

                            {Math.abs(fark) >= KURUS && (
                              <p className="text-xs text-amber-700">
                                {fark > 0
                                  ? `${para(fark)} aktarılmayacak — kasıtlıysa sorun yok.`
                                  : `Ekstre tutarından ${para(-fark)} fazla giriliyor.`}
                              </p>
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
            Aktarılacak tutar her satırda elle değiştirilebilir — bir veli aynı havaleyle
            hem yemekhane hem kantin ücretini yatırmış olabilir. Tutarın tamamı
            aktarılmazsa uyarı çıkar ama engel olmaz. <strong>Kardeşi tanımlı</strong>{' '}
            öğrencilerde ödemeyi kardeşler arasında bölmek için mor düğmeyi kullanın;
            kardeşin borcu kadarı ona ayrılır. Aktarılan kayıtlar <strong>havale</strong>{' '}
            olarak işlenir ve banka fiş numarası saklanır.
          </p>
        </>
      )}
    </div>
  )
}
