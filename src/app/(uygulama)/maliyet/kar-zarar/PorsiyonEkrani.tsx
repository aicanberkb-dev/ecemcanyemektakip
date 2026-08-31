'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

import { useBugun } from '@/components/BugunSaglayici'
import { AY_ADLARI, para } from '@/lib/format'

import {
  okulYokIsaretle,
  okulYokKaldir,
  type OkulsuzGun,
} from '../../okulsuz-actions'

import { gunlukHizmetKaydet, type MaliyetDurumu } from '../actions'

/** Bir ayın genel gider özeti — aralık iki ayı kapsayabildiği için ay ay */
export type AyGideri = {
  /** "2026-08" */
  anahtar: string
  toplam: number
  hizmetGunu: number
  gunlukGider: number
}

export type GunlukKisi = { tarih: string; kisi_sayisi: number | null }
export type GunlukCikan = { tarih: string; yemek_adi: string; porsiyon: number }
export type SatisFiyati = { gecerli_baslangic: string; kisi_basi_fiyat: number | string }
export type OkulGunu = {
  tarih: string
  kisi: number
  misafir: number
  ciro: number | string
}

export type GunKalemleri = {
  tarih: string
  corba: string | null
  corba_maliyet: number | string
  ana_yemek: string | null
  ana_yemek_maliyet: number | string
  yardimci: string | null
  yardimci_maliyet: number | string
  ek: string | null
  ek_maliyet: number | string
}

const GUN_ADI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

const SLOTLAR = ['corba', 'ana_yemek', 'yardimci', 'ek'] as const
type Slot = (typeof SLOTLAR)[number]

const SLOT_ETIKET: Record<Slot, string> = {
  corba: 'Çorba',
  ana_yemek: 'Ana Yemek',
  yardimci: 'Yardımcı',
  ek: '4. Kalem',
}

type Kalem = { yemek: string; birim: number }

/**
 * Bir yerin bir aylık çıkan porsiyonları — yemek bazında.
 *
 * Menüdeki kalemler aynı sayıda çıkmıyor: 80 kişilik bir yere ıspanak 50,
 * tatlı 100 kişilik gönderiliyor, çünkü çocukların ıspanağı sevmediği biliniyor
 * ve tatlıyı iki alan oluyor. Maliyetin doğru tabanı bu; yiyen kişi yalnızca
 * ciroyu belirler.
 *
 * Boş bırakılan kalem yerin varsayılan porsiyonunu kullanır — normal günde
 * hiçbir şey yazmadan doğru sonuç çıkar, yalnızca sapan kalem yazılır.
 */
export function PorsiyonEkrani({
  noktaId,
  noktaAdi,
  okulaBagliMi,
  varsayilanKisi,
  varsayilanCikan,
  listesizMi,
  bas,
  bit,
  kisiler,
  kalemler,
  cikanlar,
  okulGunleri,
  fiyatlar,
  giderler,
  okulsuz,
}: {
  noktaId: string
  noktaAdi: string
  okulaBagliMi: boolean
  varsayilanKisi: number
  varsayilanCikan: number
  listesizMi: boolean
  /** Gösterilecek aralık — ay seçimi de aralığa çevrilmiş hâlde gelir */
  bas: string
  bit: string
  kisiler: GunlukKisi[]
  kalemler: GunKalemleri[]
  cikanlar: GunlukCikan[]
  okulGunleri: OkulGunu[]
  /** Dış hizmet yerlerinin tarihli satış fiyatları, en yeni önce */
  fiyatlar: SatisFiyati[]
  /** Aralıktaki her ayın genel gider özeti; günlük pay buradan okunur */
  giderler: AyGideri[]
  /** Bu ayın kapalı günleri: resmi tatil (yer boş) ya da bu yere özel gezi */
  okulsuz: OkulsuzGun[]
}) {
  const router = useRouter()
  const [durum, setDurum] = useState<MaliyetDurumu>({})
  const [kaydediliyor, basla] = useTransition()
  const bugun = useBugun()

  /** tarih → slot → { yemek, kişi başı maliyet } */
  const menuHaritasi = useMemo(() => {
    const m = new Map<string, Partial<Record<Slot, Kalem>>>()
    for (const g of kalemler) {
      const gun: Partial<Record<Slot, Kalem>> = {}
      if (g.corba) gun.corba = { yemek: g.corba, birim: Number(g.corba_maliyet) }
      if (g.ana_yemek)
        gun.ana_yemek = { yemek: g.ana_yemek, birim: Number(g.ana_yemek_maliyet) }
      if (g.yardimci) gun.yardimci = { yemek: g.yardimci, birim: Number(g.yardimci_maliyet) }
      if (g.ek) gun.ek = { yemek: g.ek, birim: Number(g.ek_maliyet) }
      m.set(g.tarih, gun)
    }
    return m
  }, [kalemler])

  const okulHaritasi = useMemo(() => {
    const m = new Map<string, OkulGunu>()
    for (const g of okulGunleri) m.set(g.tarih, g)
    return m
  }, [okulGunleri])

  /** tarih → kapalı gün kaydı */
  const okulsuzHarita = useMemo(() => {
    const m = new Map<string, OkulsuzGun>()
    for (const o of okulsuz) m.set(o.tarih, o)
    return m
  }, [okulsuz])

  /**
   * Aralıktaki hafta içi günler — kapalı günler dahil.
   *
   * Hafta sonu her zaman kapalıdır ve tabloda hiç görünmez; cumartesi-pazara
   * yanlışlıkla girilmiş bir kayıt aşağıda uyarı olarak çıkar.
   *
   * "Okul yok" işaretli gün satır olarak kalır ama değerleri 0'dır. Satırı
   * tamamen kaldırmak kafa karıştırıyordu: ayın 12'si ile 14'ü arasında 13
   * yokken insanın aklına "acaba unuttum mu?" geliyor. Satır durunca neden
   * boş olduğu da yazıyor.
   */
  const gunler = useMemo(() => {
    const liste: string[] = []
    const d = new Date(`${bas}T00:00:00`)
    const son = new Date(`${bit}T00:00:00`)
    const iki = (n: number) => String(n).padStart(2, '0')
    while (d <= son) {
      const h = d.getDay()
      if (h !== 0 && h !== 6) {
        liste.push(`${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`)
      }
      d.setDate(d.getDate() + 1)
    }
    return liste
  }, [bas, bit])

  /** Açık iş günleri — toplamlar ve gider payı bunlar üzerinden hesaplanır. */
  const acikGunler = useMemo(
    () => gunler.filter((t) => !okulsuzHarita.has(t)),
    [gunler, okulsuzHarita],
  )

  /** ay anahtarı → o ayın genel gider özeti */
  const giderHaritasi = useMemo(() => {
    const m = new Map<string, AyGideri>()
    for (const g of giderler) m.set(g.anahtar, g)
    return m
  }, [giderler])

  /** Hafta sonuna girilmiş yemek kayıtları — hesaba katılmadı, görünsün. */
  const haftaSonuKayitlari = useMemo(
    () =>
      okulGunleri.filter((o) => {
        const h = new Date(o.tarih).getDay()
        return h === 0 || h === 6
      }),
    [okulGunleri],
  )

  // Porsiyon girdileri: "tarih|yemek" → değer
  const [porsiyon, setPorsiyon] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {}
    for (const c of cikanlar) b[`${c.tarih}|${c.yemek_adi}`] = String(c.porsiyon)
    return b
  })

  // Faturalanan kişi: tarih → değer (yalnızca dış hizmet yerlerinde)
  const [yiyen, setYiyen] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {}
    for (const k of kisiler) if (k.kisi_sayisi !== null) b[k.tarih] = String(k.kisi_sayisi)
    return b
  })

  const [topluDeger, setTopluDeger] = useState('')

  function etkinYiyen(tarih: string): number {
    if (okulaBagliMi) {
      const o = okulHaritasi.get(tarih)
      return o ? Number(o.kisi) + Number(o.misafir) : 0
    }
    const d = yiyen[tarih]
    if (d !== undefined && d.trim() !== '') return Number(d) || 0
    return tarih > bugun ? 0 : varsayilanKisi
  }

  /**
   * Bir kalemin o günkü porsiyonu.
   *
   * Kendi okullarımızda tahmin yürütmüyoruz: ne yazıldıysa o. Gerçek sayıyı
   * yemekhane biliyor ve giriyor; sistemin sayı önermesi hem yanıltıcı hem de
   * girilmiş veriyle karıştırılmaya açıktı. Dış hizmet yerlerinde ise sabit
   * porsiyon var, çünkü oralara her gün aynı miktar gidiyor.
   */
  function etkinPorsiyon(tarih: string, yemek: string): number {
    const d = porsiyon[`${tarih}|${yemek}`]
    if (d !== undefined && d.trim() !== '') return Number(d) || 0
    if (okulaBagliMi || tarih > bugun) return 0
    return varsayilanCikan > 0 ? varsayilanCikan : etkinYiyen(tarih)
  }

  /**
   * O günün cirosu.
   *
   * Okullarda gün sonu kayıtlarından hazır geliyor (günlükçünün gerçek tutarı,
   * aylıkçının o günkü tarifesi, ücretli öğünler). Dış hizmet yerlerinde
   * faturalanan kişi × o tarihte geçerli sözleşme fiyatı.
   */
  function gunCirosu(tarih: string): number {
    if (okulaBagliMi) return Number(okulHaritasi.get(tarih)?.ciro ?? 0)
    const f = fiyatlar.find((x) => x.gecerli_baslangic <= tarih)
    return etkinYiyen(tarih) * Number(f?.kisi_basi_fiyat ?? 0)
  }

  function gunMaliyeti(tarih: string): number {
    const gun = menuHaritasi.get(tarih)
    if (!gun) return 0
    return SLOTLAR.reduce((t, s) => {
      const k = gun[s]
      return k ? t + etkinPorsiyon(tarih, k.yemek) * k.birim : t
    }, 0)
  }

  /**
   * O günün fire tutarı: her kalemde gönderilenin yiyenden fazlası.
   *
   * Kalem kalem hesaplanıyor çünkü porsiyonlar bilerek farklı: ıspanak 50
   * gönderilip 80 kişi geldiyse orada fire yok, tatlı 100 gönderilip 80 kişi
   * geldiyse 20 porsiyon çöpe gitmiş demektir.
   */
  function gunFiresi(tarih: string): { porsiyon: number; tutar: number } {
    const gun = menuHaritasi.get(tarih)
    if (!gun) return { porsiyon: 0, tutar: 0 }
    const yiyen = etkinYiyen(tarih)
    return SLOTLAR.reduce(
      (t, s) => {
        const k = gun[s]
        if (!k) return t
        const artan = etkinPorsiyon(tarih, k.yemek) - yiyen
        return artan > 0
          ? { porsiyon: t.porsiyon + artan, tutar: t.tutar + artan * k.birim }
          : t
      },
      { porsiyon: 0, tutar: 0 },
    )
  }

  function gunPorsiyonu(tarih: string): number {
    const gun = menuHaritasi.get(tarih)
    if (!gun) return 0
    return SLOTLAR.reduce((t, s) => {
      const k = gun[s]
      return k ? t + etkinPorsiyon(tarih, k.yemek) : t
    }, 0)
  }

  /** Bugüne kadarki günlerin tüm kalemlerine aynı porsiyonu yazar. */
  function hepsineUygula() {
    const yeni = { ...porsiyon }
    for (const tarih of acikGunler) {
      if (tarih > bugun) continue
      const gun = menuHaritasi.get(tarih)
      if (!gun) continue
      for (const s of SLOTLAR) {
        const k = gun[s]
        if (k) yeni[`${tarih}|${k.yemek}`] = topluDeger.trim()
      }
    }
    setPorsiyon(yeni)
    setDurum({})
  }

  function kaydet() {
    basla(async () => {
      const cikanGirdileri: { tarih: string; yemek_adi: string; porsiyon: number | null }[] = []
      for (const tarih of acikGunler) {
        const gun = menuHaritasi.get(tarih)
        if (!gun) continue
        for (const s of SLOTLAR) {
          const k = gun[s]
          if (!k) continue
          const d = porsiyon[`${tarih}|${k.yemek}`]
          cikanGirdileri.push({
            tarih,
            yemek_adi: k.yemek,
            porsiyon: d === undefined || d.trim() === '' ? null : Number(d),
          })
        }
      }

      const kisiGirdileri = acikGunler.map((tarih) => ({
        tarih,
        kisi_sayisi:
          okulaBagliMi || !yiyen[tarih] || yiyen[tarih].trim() === ''
            ? null
            : Number(yiyen[tarih]),
      }))

      const s = await gunlukHizmetKaydet(noktaId, kisiGirdileri, cikanGirdileri)
      setDurum(s)
      if (s.basari) router.refresh()
    })
  }

  /**
   * O güne düşen genel gider payı.
   *
   * Açık her iş günü payını alır: o gün kimse yemese de kira işliyor, maaş
   * işliyor. Kapalı güne ve geleceğe yazılmaz — gider gün geldikçe
   * yapıştırılır.
   */
  function gunGenelGideri(tarih: string): number {
    if (tarih > bugun || okulsuzHarita.has(tarih)) return 0
    return giderHaritasi.get(tarih.slice(0, 7))?.gunlukGider ?? 0
  }

  /** Bir günü kapatır: resmi tatil ya da bu yere özel gezi. */
  function okulYok(tarih: string) {
    const sebep = window.prompt(
      `${noktaAdi} — ${tarih} neden kapalı? (gezi, resmi tatil…)`,
      'Gezi',
    )
    if (sebep === null) return
    basla(async () => {
      setDurum(await okulYokIsaretle(tarih, noktaId, sebep))
      router.refresh()
    })
  }

  function okulVar(id: string) {
    basla(async () => {
      setDurum(await okulYokKaldir(id))
      router.refresh()
    })
  }

  const toplam = acikGunler.reduce(
    (t, tarih) => ({
      porsiyon: t.porsiyon + gunPorsiyonu(tarih),
      yiyen: t.yiyen + etkinYiyen(tarih),
      maliyet: t.maliyet + gunMaliyeti(tarih),
      gider: t.gider + gunGenelGideri(tarih),
      ciro: t.ciro + gunCirosu(tarih),
      fire: t.fire + gunFiresi(tarih).tutar,
      firePorsiyon: t.firePorsiyon + gunFiresi(tarih).porsiyon,
    }),
    { porsiyon: 0, yiyen: 0, maliyet: 0, gider: 0, ciro: 0, fire: 0, firePorsiyon: 0 },
  )

  const menusuzGun = acikGunler.filter(
    (t) => !menuHaritasi.has(t) && gunPorsiyonu(t) + etkinYiyen(t) > 0,
  ).length
  /** Menüsü olan ama porsiyonu hiç girilmemiş günler — maliyeti 0 çıkar. */
  const cikansizGun = acikGunler.filter(
    (t) =>
      t <= bugun &&
      menuHaritasi.has(t) &&
      gunPorsiyonu(t) === 0 &&
      // Okullarda o gün yemek yiyen yoksa zaten hizmet verilmemiştir
      (!okulaBagliMi || okulHaritasi.has(t)),
  ).length

  return (
    <div className="kart p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="font-semibold">
            {noktaAdi} — çıkan porsiyonlar ({acikGunler.length} açık iş günü)
          </h2>
          <p className="max-w-3xl text-xs text-solgun">
            Her yemeğin kaç kişilik çıktığını ayrı yazın — ıspanak 50, tatlı 100 olabilir.{' '}
            {okulaBagliMi ? (
              <>
                Burada tahmin yürütülmez: <strong>yalnızca yazdığınız</strong> porsiyonlar
                maliyete girer, boş kalem 0 sayılır.
              </>
            ) : (
              <>
                Boş bıraktığınız kalem yerin sabit porsiyonunu (
                <strong>{varsayilanCikan || 'girilmemiş'}</strong>) kullanır, ileri tarihler
                gün geldikçe eklenir.{' '}
                <Link href="/maliyet/yerler" className="text-vurgu hover:underline">
                  Sabit değerleri değiştir
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="etiket text-xs">Tüm kalemlere</label>
            <input
              value={topluDeger}
              onChange={(e) => setTopluDeger(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder="ör. 80"
              className="girdi !py-1.5 w-24"
            />
          </div>
          <button type="button" onClick={hepsineUygula} className="btn-ikincil !py-1.5">
            Uygula
          </button>
          <button
            type="button"
            onClick={kaydet}
            disabled={kaydediliyor}
            className="btn-birincil !py-1.5"
          >
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {durum.basari && (
        <p className="mt-2 text-sm font-medium text-emerald-700">{durum.basari}</p>
      )}
      {durum.hata && <p className="hata mt-2">{durum.hata}</p>}

      {giderler.some((g) => g.gunlukGider > 0) ? (
        <div className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-900">
          {giderler
            .filter((g) => g.toplam > 0)
            .map((g) => (
              <p key={g.anahtar}>
                {AY_ADLARI[Number(g.anahtar.slice(5)) - 1]} {g.anahtar.slice(0, 4)}: aylık{' '}
                <strong>{para(g.toplam)}</strong> ÷ <strong>{g.hizmetGunu} iş günü</strong> ={' '}
                <strong>{para(g.gunlukGider)}</strong> her iş gününe yapıştırılıyor.
              </p>
            ))}
          <p className="mt-1 text-xs">
            Bölen ayın tamamı; yapıştırma bugüne kadar, geleceğe dönük gider yazılmaz.{' '}
            <Link href="/maliyet/giderler" className="underline">
              Giderleri düzenle
            </Link>
          </p>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-solgun">
          Bu yere genel gider girilmemiş; tabloda yalnızca malzeme maliyeti var. Maaş,
          kira ve mazotu eklemek için{' '}
          <Link href="/maliyet/giderler" className="text-vurgu underline">
            Genel Giderler
          </Link>{' '}
          sekmesini kullanın.
        </p>
      )}

      {haftaSonuKayitlari.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>{haftaSonuKayitlari.length} hafta sonu gününde</strong> yemek kaydı var
          (toplam{' '}
          {para(haftaSonuKayitlari.reduce((t, o) => t + Number(o.ciro), 0))}). Hafta sonu
          her zaman kapalı sayıldığı için bu kayıtlar tabloya girmedi — yanlış güne
          işlenmiş olabilirler.
        </p>
      )}

      {cikansizGun > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <strong>{cikansizGun}</strong> günün porsiyonu bilinmiyor; o günlerde maliyet yiyen
          kişiden hesaplandı ve israf görünmüyor. Yerin sabit porsiyonunu bir kez girmeniz
          yeter.
        </p>
      )}

      {!okulaBagliMi && varsayilanKisi === 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu yerin faturalanan kişi sayısı girilmemiş; ciro 0 çıkar.{' '}
          <Link href="/maliyet/yerler" className="underline">
            Hizmet Yerleri
          </Link>{' '}
          sekmesinden bir kez girin.
        </p>
      )}

      {listesizMi ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bu yere menü listesi bağlanmamış; hangi yemeğin çıktığı bilinmediği için maliyet
          hesaplanamıyor. <strong>Hizmet Yerleri</strong> sekmesinden bir menü seçin.
        </p>
      ) : (
        menusuzGun > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <strong>{menusuzGun}</strong> günün menüsü girilmemiş; o günlerin maliyeti 0 ₺
            sayılıyor.{' '}
            <Link href="/menu" className="underline">
              Yemek listesinden girin
            </Link>
            .
          </p>
        )
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th className="w-24">Gün</th>
              {SLOTLAR.map((s) => (
                <th key={s} className="min-w-44">
                  {SLOT_ETIKET[s]}
                </th>
              ))}
              <th className="w-28 text-right">Yiyen</th>
              <th className="text-right">Fire</th>
              <th className="text-right">Ciro</th>
              <th className="text-right">Malzeme</th>
              <th className="text-right">Genel Gider</th>
              <th className="text-right">Günün Maliyeti</th>
              <th className="text-right">Kâr / Zarar</th>
            </tr>
          </thead>
          <tbody>
            {gunler.map((tarih) => {
              const d = new Date(tarih)
              const gun = menuHaritasi.get(tarih)
              const gelecek = tarih > bugun
              const bugunMu = tarih === bugun
              const okulGunu = okulHaritasi.get(tarih)
              const yiyenSayisi = etkinYiyen(tarih)
              const kapali = okulsuzHarita.get(tarih)

              // Kapalı gün satırda kalır ama her değeri 0: gün atlanmış gibi
              // görünmesin, neden boş olduğu okunsun.
              if (kapali) {
                return (
                  <tr key={tarih} className="bg-slate-50 text-solgun">
                    <td className="whitespace-nowrap">
                      <span className="font-semibold tabular-nums">{d.getDate()}</span>
                      <span className="ml-1 text-xs">{GUN_ADI[d.getDay()]}</span>
                    </td>
                    <td colSpan={SLOTLAR.length} className="text-sm">
                      <span className="rozet bg-slate-200 text-slate-700">okul yok</span>
                      {kapali.sebep && <span className="ml-2">{kapali.sebep}</span>}
                      {!kapali.hizmet_noktasi_id && (
                        <span className="ml-2 text-xs text-violet-700">tüm yerler</span>
                      )}
                      <button
                        type="button"
                        onClick={() => okulVar(kapali.id)}
                        disabled={kaydediliyor}
                        className="ml-3 text-xs text-vurgu hover:underline"
                      >
                        geri al
                      </button>
                    </td>
                    <td className="text-right tabular-nums">0</td>
                    <td className="text-right tabular-nums">—</td>
                    <td className="text-right tabular-nums">{para(0)}</td>
                    <td className="text-right tabular-nums">{para(0)}</td>
                    <td className="text-right tabular-nums">{para(0)}</td>
                    <td className="text-right tabular-nums">{para(0)}</td>
                    <td className="text-right tabular-nums">{para(0)}</td>
                  </tr>
                )
              }

              return (
                <tr key={tarih} className={bugunMu ? 'bg-blue-50/50' : undefined}>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{d.getDate()}</span>
                    <span className="ml-1 text-xs text-solgun">{GUN_ADI[d.getDay()]}</span>
                    {bugunMu && (
                      <span className="rozet ml-1 bg-blue-100 text-blue-800">bugün</span>
                    )}
                    <button
                      type="button"
                      onClick={() => okulYok(tarih)}
                      disabled={kaydediliyor}
                      className="block text-[10px] text-slate-500 hover:text-red-600
                                 hover:underline"
                      title="Bu gün okul yok — tatil ya da gezi. Gün tablodan çıkar ve genel giderin bölündüğü iş gününden düşer."
                    >
                      okul yok
                    </button>
                  </td>

                  {SLOTLAR.map((s) => {
                    const k = gun?.[s]
                    if (!k)
                      return (
                        <td key={s} className="text-xs text-solgun">
                          —
                        </td>
                      )
                    const anahtar = `${tarih}|${k.yemek}`
                    const p = etkinPorsiyon(tarih, k.yemek)
                    return (
                      <td key={s} className="!py-1.5">
                        <div className="text-[11px] leading-tight font-medium text-slate-700">
                          {k.yemek}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <input
                            value={porsiyon[anahtar] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9]/g, '')
                              setPorsiyon((o) => ({ ...o, [anahtar]: v }))
                              setDurum({})
                            }}
                            inputMode="numeric"
                            placeholder={
                              gelecek || okulaBagliMi ? '—' : String(varsayilanCikan || '?')
                            }
                            title={`${k.yemek} — kaç kişilik çıktı`}
                            className="w-16 rounded border border-cizgi bg-white px-1.5 py-0.5
                                       text-right text-sm font-semibold tabular-nums outline-none
                                       placeholder:font-normal placeholder:text-slate-400
                                       focus:border-vurgu focus:ring-2 focus:ring-blue-100"
                          />
                          <span className="text-[10px] text-solgun">
                            {k.birim > 0 ? para(p * k.birim) : '0 ₺'}
                          </span>
                        </div>
                        {/* Bu kalemde gönderilenin yiyenden fazlası çöpe gitti */}
                        {p - yiyenSayisi > 0 && (
                          <div
                            className="text-[10px] font-medium text-orange-700"
                            title={`${k.yemek}: ${p} çıktı, ${yiyenSayisi} kişi yedi`}
                          >
                            fire {p - yiyenSayisi}
                            {k.birim > 0 && ` · ${para((p - yiyenSayisi) * k.birim)}`}
                          </div>
                        )}
                      </td>
                    )
                  })}

                  <td className="text-right">
                    {okulaBagliMi ? (
                      <span className="tabular-nums">
                        {okulGunu ? (
                          <>
                            {okulGunu.kisi}
                            {Number(okulGunu.misafir) > 0 && (
                              <span className="text-solgun"> ({okulGunu.misafir})</span>
                            )}
                          </>
                        ) : (
                          <span className="text-solgun">—</span>
                        )}
                      </span>
                    ) : (
                      <input
                        value={yiyen[tarih] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, '')
                          setYiyen((o) => ({ ...o, [tarih]: v }))
                          setDurum({})
                        }}
                        inputMode="numeric"
                        placeholder={gelecek ? '—' : String(varsayilanKisi)}
                        title="Faturalanan kişi sayısı"
                        className="w-20 rounded border border-cizgi bg-white px-2 py-1 text-right
                                   text-sm tabular-nums outline-none placeholder:text-slate-400
                                   focus:border-vurgu focus:ring-2 focus:ring-blue-100"
                      />
                    )}
                  </td>

                  {(() => {
                    const ciro = gunCirosu(tarih)
                    const malzeme = gunMaliyeti(tarih)
                    const gider = gunGenelGideri(tarih)
                    const maliyet = malzeme + gider
                    const fire = gunFiresi(tarih)
                    const kar = ciro - maliyet
                    const veriVar = ciro > 0 || maliyet > 0
                    return (
                      <>
                        <td
                          className={`text-right tabular-nums ${
                            fire.tutar > 0 ? 'text-orange-700' : 'text-solgun'
                          }`}
                        >
                          {fire.porsiyon > 0 ? (
                            <>
                              {para(fire.tutar)}{' '}
                              <span
                                className="font-normal"
                                title={`${fire.porsiyon} öğün çöpe gitti`}
                              >
                                ({fire.porsiyon})
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="text-right tabular-nums">
                          {ciro > 0 ? para(ciro) : <span className="text-solgun">—</span>}
                        </td>
                        <td className="text-right tabular-nums">
                          {gun ? para(malzeme) : <span className="text-solgun">—</span>}
                        </td>
                        <td
                          className={`text-right tabular-nums ${
                            gider > 0 ? 'text-violet-700' : 'text-solgun'
                          }`}
                        >
                          {gider > 0 ? para(gider) : '—'}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {veriVar ? para(maliyet) : <span className="text-solgun">—</span>}
                        </td>
                        <td
                          className={`text-right font-semibold tabular-nums ${
                            !veriVar ? 'text-solgun' : kar < 0 ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {veriVar ? para(kar) : '—'}
                        </td>
                      </>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="font-semibold">Toplam</td>
              <td colSpan={4} className="text-xs text-solgun">
                {toplam.porsiyon} porsiyon çıktı
                {toplam.yiyen > 0 &&
                  ` · kişi başı gerçek maliyet ${para(
                    (toplam.maliyet + toplam.gider) / toplam.yiyen,
                  )}`}
              </td>
              <td className="text-right font-semibold tabular-nums">{toplam.yiyen}</td>
              <td
                className={`text-right font-semibold tabular-nums ${
                  toplam.fire > 0 ? 'text-orange-700' : 'text-solgun'
                }`}
              >
                {para(toplam.fire)}
                {toplam.firePorsiyon > 0 && (
                  <span className="font-normal"> ({toplam.firePorsiyon})</span>
                )}
              </td>
              <td className="text-right font-semibold tabular-nums">{para(toplam.ciro)}</td>
              <td className="text-right font-semibold tabular-nums">{para(toplam.maliyet)}</td>
              <td className="text-right font-semibold tabular-nums text-violet-700">
                {para(toplam.gider)}
              </td>
              <td className="text-right font-bold tabular-nums">
                {para(toplam.maliyet + toplam.gider)}
              </td>
              <td
                className={`text-right font-bold tabular-nums ${
                  toplam.ciro - toplam.maliyet - toplam.gider < 0
                    ? 'text-red-600'
                    : 'text-emerald-700'
                }`}
              >
                {para(toplam.ciro - toplam.maliyet - toplam.gider)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
