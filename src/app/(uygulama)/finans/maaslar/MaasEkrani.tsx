'use client'

import { useRouter } from 'next/navigation'
import { Fragment, useActionState, useState } from 'react'

import { CALISMA_YERLERI, calismaYeriSirasi } from '@/lib/calisma-yerleri'
import { ayinSonGunu, SGK_KALEMLERI, sgkKalemiMi } from '@/lib/sgk-kalemleri'
import { AY_ADLARI, bugunISO, para, tarih as tarihBicim } from '@/lib/format'

import {
  giderKaydet,
  giderOdemeDegistir,
  giderSil,
  maasGeriAl,
  maasOde,
  personelAyaGizle,
  personelCikar,
  personelEkle,
  personelGuncelle,
  sgkAyaGizle,
  sgkKaydet,
  ucretSil,
  type FinansDurumu,
} from '../actions'

export type Personel = {
  id: string
  ad: string
  calistigi_yer: string | null
  sigorta_yeri: string | null
  maas_gunu: number | null
  aktif: boolean
  sira: number
}

export type Ucret = {
  id: string
  personel_id: string
  gecerli_baslangic: string
  tutar: number | string
  aciklama: string | null
}

export type MaasOdemesi = {
  id: string
  personel_id: string
  donem_yil: number
  donem_ay: number
  tutar: number | string
  odeme_tarihi: string | null
}

export type Gider = {
  id: string
  tur: string
  donem_yil: number
  donem_ay: number
  tutar: number | string
  odeme_tarihi: string | null
  aciklama: string | null
}

function sayiOku(metin: string): number {
  const temiz = metin.trim().replace(/\s/g, '')
  if (temiz === '') return 0
  const normal = temiz.includes(',') ? temiz.replace(/\./g, '').replace(',', '.') : temiz
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}

/** Dönem içindeki maaş gününün tam tarihi — ayın son gününü aşmaz. */
function maasTarihi(yil: number, ay: number, gun: number | null): string | null {
  if (!gun) return null
  const sonGun = new Date(yil, ay, 0).getDate()
  const g = Math.min(gun, sonGun)
  return `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
}

/**
 * Aylık maaş takibi.
 *
 * Excel'de her ay bir sütundu ve ödenene "x" konuyordu; geciken kırmızıya
 * boyanıyordu. Burada ay seçiliyor, ödenen satır yeşil, maaş günü geçip
 * ödenmemiş olan kırmızı oluyor.
 */
export function MaasEkrani({
  yil,
  ay,
  personeller,
  ucretler,
  odemeler,
  giderler,
  gizliler,
  sgkGizli,
}: {
  yil: number
  ay: number
  personeller: Personel[]
  ucretler: Ucret[]
  odemeler: MaasOdemesi[]
  giderler: Gider[]
  /** Bu ay listeden elle çıkarılan personelin id'leri */
  gizliler: string[]
  /** Bu ay şablondan çıkarılan SGK kalemleri */
  sgkGizli: string[]
}) {
  const bugun = bugunISO()
  const [acik, setAcik] = useState(false)
  const [giderAcik, setGiderAcik] = useState(false)
  const [pasifGoster, setPasifGoster] = useState(false)
  const [pDurum, pGonder, pBekliyor] = useActionState(personelEkle, {} as FinansDurumu)
  const [gDurum, gGonder, gBekliyor] = useActionState(giderKaydet, {} as FinansDurumu)

  if (pDurum.basari && acik) setAcik(false)
  if (gDurum.basari && giderAcik) setGiderAcik(false)

  // O ay çıkarılan personel listede durmaz; altındaki şeritten geri gelir.
  const gosterilen = personeller.filter(
    (p) => (pasifGoster || p.aktif) && !gizliler.includes(p.id),
  )
  const ayGizlileri = personeller.filter((p) => gizliler.includes(p.id))

  /** O dönemde geçerli ücret: dönem sonuna kadar başlayan en yeni satır. */
  const donemSonu = `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`
  const ucretBul = (personelId: string) =>
    ucretler.find((u) => u.personel_id === personelId && u.gecerli_baslangic <= donemSonu)

  const satirlar = gosterilen.map((p) => {
    const odeme = odemeler.find((o) => o.personel_id === p.id)
    const ucret = ucretBul(p.id)
    const beklenen = Number(ucret?.tutar ?? 0)
    const vade = maasTarihi(yil, ay, p.maas_gunu)
    return {
      personel: p,
      odeme,
      beklenen,
      vade,
      gecikti: !odeme && !!vade && vade < bugun,
      bugunMu: !odeme && vade === bugun,
    }
  })

  const toplamBeklenen = satirlar.reduce((t, s) => t + s.beklenen, 0)
  const toplamOdenen = satirlar.reduce((t, s) => t + Number(s.odeme?.tutar ?? 0), 0)
  const gecikenSayisi = satirlar.filter((s) => s.gecikti).length
  const giderToplam = giderler.reduce((t, g) => t + Number(g.tutar), 0)

  // SGK sabit şablon, geri kalanı o aya özel ekstra gider
  const sgkVadesi = ayinSonGunu(yil, ay)
  const sgkSatirlari = giderler.filter((g) => sgkKalemiMi(g.tur))
  const ekstraGiderler = giderler.filter((g) => !sgkKalemiMi(g.tur))
  const sgkToplam = sgkSatirlari.reduce((t, g) => t + Number(g.tutar), 0)
  const sgkOdenen = sgkSatirlari
    .filter((g) => g.odeme_tarihi)
    .reduce((t, g) => t + Number(g.tutar), 0)
  const ekstraToplam = ekstraGiderler.reduce((t, g) => t + Number(g.tutar), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Ozet baslik="Bu ay maaş" tutar={toplamBeklenen} renk="bg-slate-100 text-slate-800" />
        <Ozet baslik="Ödenen" tutar={toplamOdenen} renk="bg-emerald-50 text-emerald-800" />
        <Ozet
          baslik="Kalan"
          tutar={toplamBeklenen - toplamOdenen}
          renk={
            gecikenSayisi > 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
          }
          alt={gecikenSayisi > 0 ? `${gecikenSayisi} kişi gecikmiş` : undefined}
        />
        <Ozet baslik="SSK / Vergi" tutar={giderToplam} renk="bg-slate-50 text-slate-700" />
      </div>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <form className="flex items-end gap-2">
          <div>
            <label className="etiket" htmlFor="ay">
              Ay
            </label>
            <select id="ay" name="ay" defaultValue={String(ay)} className="girdi">
              {AY_ADLARI.map((adi, i) => (
                <option key={adi} value={i + 1}>
                  {adi}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiket" htmlFor="yil">
              Yıl
            </label>
            <input
              id="yil"
              type="number"
              name="yil"
              defaultValue={yil}
              min={2000}
              max={2100}
              className="girdi w-28"
            />
          </div>
          <button className="btn-birincil">Göster</button>
        </form>

        <label className="flex items-center gap-2 pb-2 text-sm text-solgun">
          <input
            type="checkbox"
            checked={pasifGoster}
            onChange={(e) => setPasifGoster(e.target.checked)}
          />
          Çıkanları da göster
        </label>

        {!acik && (
          <button
            type="button"
            onClick={() => setAcik(true)}
            className="btn-ikincil ml-auto !py-1.5"
          >
            + Personel Ekle
          </button>
        )}
      </div>

      {acik && (
        <form action={pGonder} className="kart flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-40 flex-1">
            <label className="etiket text-xs">Ad</label>
            <input name="ad" className="girdi !py-1.5" />
            {pDurum.alanlar?.ad && <p className="hata">{pDurum.alanlar.ad}</p>}
          </div>
          <div className="min-w-36 flex-1">
            <label className="etiket text-xs">Çalıştığı yer</label>
            <select name="calistigi_yer" defaultValue="ELMALI" className="girdi !py-1.5">
              {CALISMA_YERLERI.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-36 flex-1">
            <label className="etiket text-xs">Sigorta yeri</label>
            <input name="sigorta_yeri" placeholder="ör. ELMALI" className="girdi !py-1.5" />
          </div>
          <div>
            <label className="etiket text-xs">Maaş günü</label>
            <input name="maas_gunu" inputMode="numeric" defaultValue="15" className="girdi !py-1.5 w-24" />
          </div>
          <div>
            <label className="etiket text-xs">Aylık maaş (₺)</label>
            <input
              name="maas"
              inputMode="decimal"
              placeholder="ör. 28.000"
              className="girdi !py-1.5 w-32"
            />
            {pDurum.alanlar?.maas && <p className="hata">{pDurum.alanlar.maas}</p>}
          </div>
          <input type="hidden" name="donem_yil" value={yil} />
          <input type="hidden" name="donem_ay" value={ay} />
          <button className="btn-birincil !py-1.5" disabled={pBekliyor}>
            Ekle
          </button>
          <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {pDurum.hata && <p className="hata w-full">{pDurum.hata}</p>}
          <p className="w-full text-xs text-solgun">
            Maaş {AY_ADLARI[ay - 1]} {yil} ayından itibaren geçerli olur. Zam yapınca
            satırdaki <strong>Düzelt</strong> ile yeni rakamı girin; geçmiş aylar eski
            ücretiyle kalır.
          </p>
        </form>
      )}

      <div className="kart overflow-x-auto">
        <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
          {AY_ADLARI[ay - 1]} {yil}
        </h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Personel</th>
              <th>Çalıştığı yer</th>
              <th>Sigorta yeri</th>
              <th className="text-right">Maaş günü</th>
              <th className="text-right">Ücret</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {CALISMA_YERLERI.map((yer, i) => {
              // Listede olmayan eski serbest metin değerler de DİĞER altında
              const grubun = satirlar.filter(
                (s) => calismaYeriSirasi(s.personel.calistigi_yer) === i,
              )
              if (grubun.length === 0) return null
              const grupToplam = grubun.reduce((t, s) => t + s.beklenen, 0)

              return (
                <Fragment key={yer}>
                  <tr className="bg-slate-100">
                    <td
                      colSpan={4}
                      className="py-1.5 text-xs font-bold tracking-wide text-slate-700"
                    >
                      {yer}
                      <span className="ml-2 font-normal text-solgun">
                        {grubun.length} kişi
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-xs font-bold tabular-nums text-slate-700">
                      {para(grupToplam)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                  {grubun.map((s) => (
                    <PersonelSatiri
                      key={s.personel.id}
                      {...s}
                      yil={yil}
                      ay={ay}
                      bugun={bugun}
                      ucretGecmisi={ucretler.filter((u) => u.personel_id === s.personel.id)}
                    />
                  ))}
                </Fragment>
              )
            })}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-solgun">
                  Personel yok.
                </td>
              </tr>
            )}
          </tbody>
          {satirlar.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="font-semibold">
                  Toplam
                </td>
                <td className="text-right font-semibold tabular-nums">{para(toplamBeklenen)}</td>
                <td className="text-xs text-solgun">
                  ödenen {para(toplamOdenen)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {ayGizlileri.length > 0 && (
        <div className="kart flex flex-wrap items-center gap-2 p-4">
          <span className="text-sm text-solgun">
            {AY_ADLARI[ay - 1]} {yil} listesinden çıkarılanlar:
          </span>
          {ayGizlileri.map((p) => (
            <GeriGetir key={p.id} personel={p} yil={yil} ay={ay} />
          ))}
          <span className="w-full text-xs text-solgun">
            Yalnızca bu ay için çıkarıldılar; diğer aylarda listede durmaya devam
            ederler. Maaşları bu ayın genel giderine de girmez.
          </span>
        </div>
      )}

      {/* SGK — her ay aynı kalemler, maaş gibi şablon */}
      <div className="kart overflow-x-auto">
        <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-cizgi px-4 py-3">
          <span className="font-semibold">
            SGK — {AY_ADLARI[ay - 1]} {yil}
          </span>
          <span className="text-sm font-normal text-solgun">
            Vade ayın son günü: {tarihBicim(sgkVadesi)}
          </span>
        </h2>
        <table className="tablo">
          <thead>
            <tr>
              <th>Kalem</th>
              <th className="text-right">Tutar</th>
              <th>Durum</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {SGK_KALEMLERI.filter((k) => !sgkGizli.includes(k)).map((kalem) => (
              <SgkSatiri
                key={kalem}
                kalem={kalem}
                gider={giderler.find((g) => g.tur === kalem)}
                yil={yil}
                ay={ay}
                vade={sgkVadesi}
                bugun={bugun}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2">Toplam</td>
              <td className="px-3 py-2 text-right tabular-nums">{para(sgkToplam)}</td>
              <td className="px-3 py-2 text-xs font-normal text-solgun">
                ödenen {para(sgkOdenen)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
        {sgkGizli.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-cizgi px-4 py-3">
            <span className="text-sm text-solgun">Bu aydan çıkarılanlar:</span>
            {sgkGizli.map((k) => (
              <SgkGeriGetir key={k} kalem={k} yil={yil} ay={ay} />
            ))}
          </div>
        )}
      </div>

      {/* Şablon dışı, o aya özel giderler */}
      <div className="kart p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">
            Ekstra Giderler — {AY_ADLARI[ay - 1]} {yil}
          </h2>
          <span className="text-sm text-solgun">
            Vergi, tamir, ceza gibi o aya özel kalemler
          </span>
          {!giderAcik && (
            <button
              type="button"
              onClick={() => setGiderAcik(true)}
              className="btn-ikincil ml-auto !py-1.5"
            >
              + Gider Ekle
            </button>
          )}
        </div>

        {giderAcik && (
          <form action={gGonder} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="donem_yil" value={yil} />
            <input type="hidden" name="donem_ay" value={ay} />
            <div>
              <label className="etiket text-xs">Tür</label>
              <input name="tur" placeholder="ör. VERGİ" className="girdi !py-1.5 w-32" />
              {gDurum.alanlar?.tur && <p className="hata">{gDurum.alanlar.tur}</p>}
            </div>
            <div>
              <label className="etiket text-xs">Tutar (₺)</label>
              <input name="tutar" inputMode="decimal" className="girdi !py-1.5 w-36" />
            </div>
            <div>
              <label className="etiket text-xs">Ödeme tarihi</label>
              <input type="date" name="odeme_tarihi" className="girdi !py-1.5" />
            </div>
            <div className="min-w-40 flex-1">
              <label className="etiket text-xs">Açıklama</label>
              <input name="aciklama" className="girdi !py-1.5" />
            </div>
            <button className="btn-birincil !py-1.5" disabled={gBekliyor}>
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setGiderAcik(false)}
              className="btn-ikincil !py-1.5"
            >
              Vazgeç
            </button>
            {gDurum.hata && <p className="hata w-full">{gDurum.hata}</p>}
          </form>
        )}

        {ekstraGiderler.length > 0 ? (
          <table className="tablo mt-3">
            <thead>
              <tr>
                <th>Tür</th>
                <th className="text-right">Tutar</th>
                <th>Ödeme tarihi</th>
                <th>Açıklama</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {ekstraGiderler.map((g) => (
                <GiderSatiri key={g.id} gider={g} bugun={bugun} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2">Toplam</td>
                <td className="px-3 py-2 text-right tabular-nums">{para(ekstraToplam)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="mt-2 text-sm text-solgun">Bu ay için ekstra gider girilmemiş.</p>
        )}
      </div>
    </div>
  )
}

function Ozet({
  baslik,
  tutar,
  renk,
  alt,
}: {
  baslik: string
  tutar: number
  renk: string
  alt?: string
}) {
  return (
    <div className={`kart p-4 ${renk}`}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{baslik}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{para(tutar)}</p>
      {alt && <p className="mt-0.5 text-xs opacity-75">{alt}</p>}
    </div>
  )
}

/** O aydan çıkarılmış personeli geri ekler. */
function GeriGetir({
  personel,
  yil,
  ay,
}: {
  personel: Personel
  yil: number
  ay: number
}) {
  const router = useRouter()
  const [calisiyor, setCalisiyor] = useState(false)

  return (
    <button
      type="button"
      disabled={calisiyor}
      onClick={async () => {
        setCalisiyor(true)
        try {
          const s = await personelAyaGizle(personel.id, yil, ay, false)
          if (s.hata) alert(s.hata)
          else router.refresh()
        } finally {
          setCalisiyor(false)
        }
      }}
      className="rounded border border-dashed border-slate-300 px-2 py-1 text-xs
                 text-slate-600 hover:border-vurgu hover:text-vurgu"
      title="Bu aya geri ekle"
    >
      {personel.ad} <span className="font-semibold">+</span>
    </button>
  )
}

function PersonelSatiri({
  personel,
  odeme,
  beklenen,
  vade,
  gecikti,
  bugunMu,
  yil,
  ay,
  bugun,
  ucretGecmisi,
}: {
  personel: Personel
  odeme: MaasOdemesi | undefined
  beklenen: number
  vade: string | null
  gecikti: boolean
  bugunMu: boolean
  yil: number
  ay: number
  bugun: string
  ucretGecmisi: Ucret[]
}) {
  const router = useRouter()
  const [duzenle, setDuzenle] = useState(false)
  // Düzelt formunda görünecek ücret: seçili döneme kadar başlayan en yeni
  // satır — yani tablodaki "Ücret" ile aynı rakam. İleri tarihli bir zam
  // varsa onu göstermek, ağustosa bakarken eylül rakamını düzenlettirirdi.
  const donemSonu = `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`
  const guncelUcret = ucretGecmisi.find((u) => u.gecerli_baslangic <= donemSonu)
  const [tutar, setTutar] = useState(String(beklenen).replace('.', ','))
  // Ödeme tarihi elle değiştirilebilsin: maaş çoğu zaman vade gününde değil,
  // birkaç gün önce ya da sonra veriliyor.
  const [odemeTarihi, setOdemeTarihi] = useState(odeme?.odeme_tarihi ?? bugun)
  const [calisiyor, setCalisiyor] = useState(false)

  const guncelle = personelGuncelle.bind(null, personel.id)
  const [durum, gonder, bekliyor] = useActionState(guncelle, {} as FinansDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  async function calistir(is: () => Promise<FinansDurumu>) {
    setCalisiyor(true)
    try {
      const s = await is()
      if (s.hata) alert(s.hata)
      else router.refresh()
    } finally {
      setCalisiyor(false)
    }
  }

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={7} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            {/* Maaş, ekranda açık olan aydan itibaren geçerli olur */}
            <input type="hidden" name="donem_yil" value={yil} />
            <input type="hidden" name="donem_ay" value={ay} />
            <div className="min-w-36 flex-1">
              <label className="etiket text-xs">Ad</label>
              <input name="ad" defaultValue={personel.ad} className="girdi !py-1.5" />
            </div>
            <div className="min-w-36 flex-1">
              <label className="etiket text-xs">Çalıştığı yer</label>
              <select
                name="calistigi_yer"
                defaultValue={personel.calistigi_yer ?? 'DİĞER'}
                className="girdi !py-1.5"
              >
                {/* Listede olmayan eski bir değer varsa kaybolmasın: kendi
                    seçeneği olarak durur, kullanıcı isterse değiştirir. */}
                {personel.calistigi_yer &&
                  !CALISMA_YERLERI.includes(
                    personel.calistigi_yer as (typeof CALISMA_YERLERI)[number],
                  ) && (
                    <option value={personel.calistigi_yer}>
                      {personel.calistigi_yer} (listede yok)
                    </option>
                  )}
                {CALISMA_YERLERI.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-36 flex-1">
              <label className="etiket text-xs">Sigorta yeri</label>
              <input
                name="sigorta_yeri"
                defaultValue={personel.sigorta_yeri ?? ''}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Maaş günü</label>
              <input
                name="maas_gunu"
                inputMode="numeric"
                defaultValue={String(personel.maas_gunu ?? 15)}
                className="girdi !py-1.5 w-24"
              />
            </div>
            <div>
              <label className="etiket text-xs">Aylık maaş (₺)</label>
              <input
                name="maas"
                inputMode="decimal"
                defaultValue={
                  guncelUcret ? String(guncelUcret.tutar).replace('.', ',') : ''
                }
                className="girdi !py-1.5 w-32"
              />
              {durum.alanlar?.maas && <p className="hata">{durum.alanlar.maas}</p>}
            </div>
            <button className="btn-birincil !py-1.5" disabled={bekliyor}>
              Kaydet
            </button>
            <button type="button" onClick={() => setDuzenle(false)} className="btn-ikincil !py-1.5">
              Vazgeç
            </button>
            {durum.hata && <p className="hata w-full">{durum.hata}</p>}

            <p className="w-full text-xs text-solgun">
              Girdiğiniz maaş <strong>{AY_ADLARI[ay - 1]} {yil}</strong> ayından itibaren
              geçerli olur; önceki aylar kendi ücretiyle kalır. Zammı hangi aydan
              başlatmak istiyorsanız üstteki ay seçiminden o aya geçip buradan girin.
            </p>

            {ucretGecmisi.length > 0 && (
              <div className="flex w-full flex-wrap gap-2">
                {ucretGecmisi.map((u) => (
                  <span
                    key={u.id}
                    className="flex items-center gap-2 rounded border border-cizgi bg-white
                               px-2 py-1 text-xs"
                  >
                    {tarihBicim(u.gecerli_baslangic)} · <strong>{para(u.tutar)}</strong>
                    {u.aciklama && <span className="text-solgun">{u.aciklama}</span>}
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('Bu ücret satırı silinecek. Emin misiniz?')) return
                        calistir(() => ucretSil(u.id))
                      }}
                      className="text-red-600 hover:underline"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr
        className={
          odeme
            ? 'bg-emerald-50/60'
            : gecikti
              ? 'bg-red-50'
              : bugunMu
                ? 'bg-amber-50'
                : personel.aktif
                  ? undefined
                  : 'opacity-50'
        }
      >
        <td className="font-medium">
          {personel.ad}
          {!personel.aktif && (
            <span className="rozet ml-2 bg-slate-200 text-slate-600">çıktı</span>
          )}
        </td>
        <td className="text-solgun">{personel.calistigi_yer ?? '—'}</td>
        <td className="text-solgun">{personel.sigorta_yeri ?? '—'}</td>
        <td className="text-right tabular-nums">
          {personel.maas_gunu ?? '—'}
          {gecikti && <span className="rozet ml-2 bg-red-100 text-red-800">geçti</span>}
          {bugunMu && <span className="rozet ml-2 bg-amber-100 text-amber-800">bugün</span>}
        </td>
        <td className="text-right">
          <input
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            inputMode="decimal"
            title="Bu ay ödenecek tutar — avans/eksik ödeme için değiştirilebilir"
            className="w-28 rounded border border-cizgi px-2 py-1 text-right text-sm font-semibold
                       tabular-nums outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
          />
        </td>
        <td>
          {odeme ? (
            <span className="rozet bg-emerald-100 text-emerald-800">
              ödendi · {tarihBicim(odeme.odeme_tarihi)}
            </span>
          ) : ucretGecmisi.length === 0 ? (
            // Ücreti hiç tanımlanmamış personel 0 ₺ ile sessizce duruyordu;
            // maaş toplamı da genel gider de eksik çıkıyordu.
            <button
              type="button"
              onClick={() => setDuzenle(true)}
              className="rozet bg-amber-100 text-amber-800 hover:underline"
              title="Bu personelin maaşı hiç girilmemiş — toplamlara ve genel gidere 0 ₺ olarak giriyor"
            >
              maaş girilmemiş
            </button>
          ) : vade ? (
            <span className="text-xs text-solgun">vade {tarihBicim(vade)}</span>
          ) : (
            <span className="text-xs text-solgun">—</span>
          )}
        </td>
        <td className="text-right whitespace-nowrap">
          {!odeme && (
            <input
              type="date"
              value={odemeTarihi}
              onChange={(e) => setOdemeTarihi(e.target.value)}
              title="Ödemenin yapıldığı tarih — varsayılan bugün"
              className="mr-2 rounded border border-cizgi px-1 py-0.5 text-xs outline-none
                         focus:border-vurgu"
            />
          )}
          <button
            type="button"
            disabled={calisiyor}
            onClick={() => {
              if (odeme) {
                if (!confirm(`${personel.ad} — ödeme geri alınacak. Emin misiniz?`)) return
                calistir(() => maasGeriAl(personel.id, yil, ay))
              } else {
                const t = sayiOku(tutar)
                if (Number.isNaN(t) || t < 0) {
                  alert('Geçerli bir tutar girin.')
                  return
                }
                calistir(() => maasOde(personel.id, yil, ay, t, odemeTarihi))
              }
            }}
            className={`text-xs hover:underline ${
              odeme ? 'text-solgun' : 'font-semibold text-emerald-700'
            }`}
          >
            {odeme ? 'Geri al' : 'Ödendi'}
          </button>
          <span className="mx-2 text-cizgi">|</span>
          <button
            type="button"
            onClick={() => setDuzenle(true)}
            className="text-xs text-vurgu hover:underline"
            title="Bilgileri ve maaşı düzenle"
          >
            Düzelt
          </button>
          <span className="mx-2 text-cizgi">|</span>
          {/* Aya özel çıkarma: yazın çalışmayan personel için. Kalıcı
              çıkarmadan farkı, eylülde kendiliğinden geri gelmesi. */}
          <button
            type="button"
            onClick={() => calistir(() => personelAyaGizle(personel.id, yil, ay, true))}
            className="text-xs text-slate-500 hover:text-red-600 hover:underline"
            title={`${AY_ADLARI[ay - 1]} ayında çalışmadı — yalnızca bu aydan çıkarılır, diğer aylarda listede kalır ve maaşı bu ayın genel giderine girmez`}
          >
            Bu ay yok
          </button>
          <span className="mx-2 text-cizgi">|</span>
          <button
            type="button"
            onClick={() => {
              if (
                !confirm(
                  personel.aktif
                    ? `${personel.ad} listeden çıkarılsın mı? Geçmiş ödemeleri kalır.`
                    : `${personel.ad} tekrar aktifleştirilsin mi?`,
                )
              )
                return
              calistir(() => personelCikar(personel.id, !personel.aktif))
            }}
            className="text-xs text-red-600 hover:underline"
            title="Kalıcı çıkarma — tüm aylarda listeden düşer"
          >
            {personel.aktif ? 'Kalıcı çıkar' : 'Aktifleştir'}
          </button>
        </td>
      </tr>

    </>
  )
}

/**
 * Bir SGK kalemi — maaş satırıyla aynı mantık.
 *
 * Kalem her ay listede; kaydı yoksa bile satır duruyor ki hangi yerin
 * SGK'sının girilmediği görünsün. Tutar yazılıp kutudan çıkılınca kayıt
 * oluşur, sıfırlanınca silinir.
 */
function SgkSatiri({
  kalem,
  gider,
  yil,
  ay,
  vade,
  bugun,
}: {
  kalem: string
  gider: Gider | undefined
  yil: number
  ay: number
  vade: string
  bugun: string
}) {
  const router = useRouter()
  const [duzenle, setDuzenle] = useState(false)
  const [tutar, setTutar] = useState(gider ? String(gider.tutar).replace('.', ',') : '')
  const [odemeTarihi, setOdemeTarihi] = useState(gider?.odeme_tarihi ?? bugun)
  const [calisiyor, setCalisiyor] = useState(false)

  const odendi = !!gider?.odeme_tarihi
  const gecikti = !odendi && !!gider && vade < bugun

  async function calistir(is: () => Promise<FinansDurumu>) {
    setCalisiyor(true)
    try {
      const s = await is()
      if (s.hata) alert(s.hata)
      else {
        setDuzenle(false)
        router.refresh()
      }
    } finally {
      setCalisiyor(false)
    }
  }

  function kaydet() {
    const t = tutar.trim() === '' ? 0 : sayiOku(tutar)
    if (Number.isNaN(t) || t < 0) {
      alert('Geçerli bir tutar girin.')
      return
    }
    calistir(() => sgkKaydet(yil, ay, kalem, t))
  }

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td className="font-medium">{kalem}</td>
        <td colSpan={3} className="py-2">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="etiket text-xs">Tutar (₺)</label>
              <input
                autoFocus
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') kaydet()
                  if (e.key === 'Escape') setDuzenle(false)
                }}
                inputMode="decimal"
                placeholder="ör. 45.000"
                className="girdi !py-1.5 w-36"
              />
            </div>
            <button
              type="button"
              onClick={kaydet}
              disabled={calisiyor}
              className="btn-birincil !py-1.5"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setDuzenle(false)}
              className="btn-ikincil !py-1.5"
            >
              Vazgeç
            </button>
            {gider && (
              <button
                type="button"
                disabled={calisiyor}
                onClick={() => {
                  if (!confirm(`${kalem} kaydı silinecek. Emin misiniz?`)) return
                  calistir(() => sgkKaydet(yil, ay, kalem, 0))
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Sil
              </button>
            )}
            <span className="text-xs text-solgun">
              Boş bırakıp kaydetmek de satırı siler.
            </span>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={odendi ? 'bg-emerald-50/60' : gecikti ? 'bg-red-50' : undefined}>
      <td className="font-medium">{kalem}</td>
      <td className="text-right font-semibold tabular-nums">
        {gider ? para(gider.tutar) : <span className="text-solgun">—</span>}
      </td>
      <td className="whitespace-nowrap">
        {odendi ? (
          <span className="rozet bg-emerald-100 text-emerald-800">
            ödendi · {tarihBicim(gider!.odeme_tarihi)}
          </span>
        ) : gider ? (
          <span className={gecikti ? 'text-xs font-medium text-red-700' : 'text-xs text-solgun'}>
            vade {tarihBicim(vade)}
            {gecikti && ' · geçti'}
          </span>
        ) : (
          <span className="text-xs text-solgun">tutar girilmedi</span>
        )}
      </td>
      <td className="text-right whitespace-nowrap">
        {gider ? (
          <>
            {!odendi && (
              <input
                type="date"
                value={odemeTarihi}
                onChange={(e) => setOdemeTarihi(e.target.value)}
                title="Ödemenin yapıldığı tarih — varsayılan bugün"
                className="mr-2 rounded border border-cizgi px-1 py-0.5 text-xs outline-none focus:border-vurgu"
              />
            )}
            <button
              type="button"
              disabled={calisiyor}
              onClick={() =>
                calistir(() => giderOdemeDegistir(gider.id, odendi ? null : odemeTarihi))
              }
              className={odendi
                ? 'text-xs text-solgun hover:underline'
                : 'text-xs font-semibold text-emerald-700 hover:underline'}
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
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setDuzenle(true)}
              className="btn-ikincil !px-3 !py-1 text-xs"
            >
              Tutar Gir
            </button>
            <span className="mx-2 text-cizgi">|</span>
            <button
              type="button"
              disabled={calisiyor}
              onClick={() => calistir(() => sgkAyaGizle(kalem, yil, ay, true))}
              className="text-xs text-slate-500 hover:text-red-600 hover:underline"
              title="Bu ay bu kalemin SGK'sı yok — yalnızca bu aydan çıkarılır, sonraki ay yine listede"
            >
              Bu ay yok
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

/** Şablondan çıkarılmış SGK kalemini o aya geri ekler. */
function SgkGeriGetir({ kalem, yil, ay }: { kalem: string; yil: number; ay: number }) {
  const router = useRouter()
  const [calisiyor, setCalisiyor] = useState(false)

  return (
    <button
      type="button"
      disabled={calisiyor}
      onClick={async () => {
        setCalisiyor(true)
        try {
          const s = await sgkAyaGizle(kalem, yil, ay, false)
          if (s.hata) alert(s.hata)
          else router.refresh()
        } finally {
          setCalisiyor(false)
        }
      }}
      className="rounded border border-dashed border-slate-300 px-2 py-1 text-xs
                 text-slate-600 hover:border-vurgu hover:text-vurgu"
      title="Bu aya geri ekle"
    >
      {kalem} <span className="font-semibold">+</span>
    </button>
  )
}

function GiderSatiri({ gider, bugun }: { gider: Gider; bugun: string }) {
  const router = useRouter()
  const [odemeTarihi, setOdemeTarihi] = useState(gider.odeme_tarihi ?? bugun)
  const [calisiyor, setCalisiyor] = useState(false)
  const odendi = !!gider.odeme_tarihi

  async function calistir(is: () => Promise<FinansDurumu>) {
    setCalisiyor(true)
    try {
      const s = await is()
      if (s.hata) alert(s.hata)
      else router.refresh()
    } finally {
      setCalisiyor(false)
    }
  }

  return (
    <tr className={odendi ? 'bg-emerald-50/60' : undefined}>
      <td className="font-medium">{gider.tur}</td>
      <td className="text-right font-semibold tabular-nums">{para(gider.tutar)}</td>
      <td>
        {odendi ? (
          <span className="rozet bg-emerald-100 text-emerald-800">
            {tarihBicim(gider.odeme_tarihi)}
          </span>
        ) : (
          <span className="rozet bg-slate-100 text-slate-700">ödenmedi</span>
        )}
      </td>
      <td className="text-solgun">{gider.aciklama ?? '—'}</td>
      <td className="text-right whitespace-nowrap">
        {!odendi && (
          <input
            type="date"
            value={odemeTarihi}
            onChange={(e) => setOdemeTarihi(e.target.value)}
            title="Ödemenin yapıldığı tarih — varsayılan bugün"
            className="mr-2 rounded border border-cizgi px-1 py-0.5 text-xs outline-none
                       focus:border-vurgu"
          />
        )}
        <button
          type="button"
          disabled={calisiyor}
          onClick={() =>
            calistir(() => giderOdemeDegistir(gider.id, odendi ? null : odemeTarihi))
          }
          className={
            odendi
              ? 'text-xs text-solgun hover:underline'
              : 'text-xs font-semibold text-emerald-700 hover:underline'
          }
        >
          {odendi ? 'Geri al' : 'Ödendi'}
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          disabled={calisiyor}
          onClick={() => {
            if (!confirm(`${gider.tur} gideri silinecek. Emin misiniz?`)) return
            calistir(() => giderSil(gider.id))
          }}
          className="text-xs text-red-600 hover:underline"
        >
          Sil
        </button>
      </td>
    </tr>
  )
}
