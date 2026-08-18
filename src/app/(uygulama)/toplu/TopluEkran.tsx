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
  okulId,
  ogrenciler,
  siniflar,
  ucretliVarsayilan,
}: {
  gun: string
  okulId: string
  ogrenciler: TopluOgrenci[]
  siniflar: string[]
  /** Seçili günün tarifesinden gelen ücretli öğün fiyatı */
  ucretliVarsayilan: number
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
  // Kayıttan sonra adet ve fiyat kutuları varsayılana dönsün
  const [sifirlama, setSifirlama] = useState(0)

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

  async function serbestKaydet(tip: 'ucretli' | 'misafir', adet: number, fiyat?: number) {
    if (kaydediliyor) return
    setKaydediliyor(true)

    const { data, error } = await supabase.rpc('serbest_ogun_kaydet', {
      p_okul_id: okulId,
      p_tip: tip,
      p_adet: adet,
      p_tarih: gun,
      p_birim_tutar: Number.isFinite(fiyat) ? fiyat : null,
    })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    const s = (data as { eklenen: number; gun_toplami: number; birim_tutar: number }[] | null)?.[0]
    const ad = tip === 'ucretli' ? 'Ücretli' : 'Misafir'
    setMesaj({
      tip: 'ok',
      metin:
        `${ad}: ${s?.eklenen ?? adet} kayıt ${tarihBicim(gun)} tarihine eklendi` +
        `${Number(s?.birim_tutar ?? 0) > 0 ? ` (birim ${para(s!.birim_tutar)})` : ''}` +
        ` — o gün toplam ${s?.gun_toplami ?? '?'}.`,
    })
    setSifirlama((n) => n + 1)
    router.refresh()
  }

  /**
   * Ücretli/misafir öğün geri alma.
   *
   * Tutar verilirse yalnızca o fiyattan girilmiş kayıtlar silinir; o gün
   * yeterli kayıt yoksa sunucu hata verir. Sessizce başka tutarlı bir kaydı
   * silmek kasayı bozardı.
   */
  async function serbestGeriAl(tip: 'ucretli' | 'misafir', adet: number, fiyat?: number) {
    if (kaydediliyor) return
    const ad = tip === 'ucretli' ? 'ücretli' : 'misafir'
    const fiyatli = Number.isFinite(fiyat)
    if (
      !confirm(
        `${tarihBicim(gun)} tarihinden ${adet} adet ${ad} öğün kaydı SİLİNECEK.` +
          (fiyatli ? `\nBirim ${para(fiyat!)} — toplam ${para(adet * fiyat!)} iade edilecek.` : '') +
          '\nOnaylıyor musunuz?',
      )
    )
      return

    setKaydediliyor(true)
    const { data, error } = await supabase.rpc('serbest_ogun_geri_al', {
      p_okul_id: okulId,
      p_tip: tip,
      p_adet: adet,
      p_tarih: gun,
      p_birim_tutar: fiyatli ? fiyat : null,
    })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    const s = (data as { silinen: number; gun_toplami: number; iade_tutari: number }[] | null)?.[0]
    setMesaj({
      tip: 'ok',
      metin:
        `${tip === 'ucretli' ? 'Ücretli' : 'Misafir'}: ${s?.silinen ?? adet} kayıt geri alındı` +
        `${Number(s?.iade_tutari ?? 0) > 0 ? ` (${para(s!.iade_tutari)} iade)` : ''}` +
        ` — o gün toplam ${s?.gun_toplami ?? '?'}.`,
    })
    setSifirlama((n) => n + 1)
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

      {/* Serbest öğünler — öğrenciye bağlı değil, seçimden bağımsız çalışır.
          Bilgisayarın hiç açılamadığı bir günün ücretli/misafir kayıtları da
          buradan geçmişe dönük girilebilsin diye ekranda. */}
      {/* Butonlar ekranın modunu izler: yemek yedirme modundaysak ekler,
          geri alma modundaysak geri alır. İki ayrı yerde durmaları, hangi
          moddayken hangisine basıldığını karıştırmaya açıktı. */}
      <div
        className={`kart space-y-3 p-4 ${
          mod === 'geri' ? 'border-red-200 bg-red-50/40' : ''
        }`}
      >
        <div>
          <h2 className="font-semibold">
            Ücretli ve Misafir Öğün — {tarihBicim(gun)}
            <span
              className={`rozet ml-2 ${
                mod === 'ekle' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {mod === 'ekle' ? 'ekleme' : 'geri alma'}
            </span>
          </h2>
          <p className="text-sm text-solgun">
            Öğrenciye bağlı olmayan öğünler. Seçtiğiniz tarihe işlenir; fiyat o günün
            tarifesinden gelir, gerekirse değiştirebilirsiniz.
            {mod === 'geri' && (
              <>
                {' '}
                Geri alırken girdiğiniz tutar, <strong>o gün o fiyattan</strong> girilmiş
                kayıtlarla eşleşmeli — yoksa sistem uyarır.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {/* key: işlemden sonra adet ve fiyat varsayılana döner */}
          <SerbestGiris
            key={`ucretli-${mod}-${sifirlama}`}
            etiket={mod === 'ekle' ? 'Ücretli Ekle' : 'Ücretli Geri Al'}
            renk={
              mod === 'ekle'
                ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900'
                : 'bg-white hover:bg-red-100 text-red-700 border border-red-300'
            }
            varsayilanFiyat={ucretliVarsayilan}
            bekliyor={kaydediliyor}
            onGonder={(adet, fiyat) =>
              mod === 'ekle'
                ? serbestKaydet('ucretli', adet, fiyat)
                : serbestGeriAl('ucretli', adet, fiyat)
            }
          />
          {/* Misafir personel: ücret alınmıyor, sadece sayaç */}
          <SerbestGiris
            key={`misafir-${mod}-${sifirlama}`}
            etiket={mod === 'ekle' ? 'Misafir Ekle' : 'Misafir Geri Al'}
            renk={
              mod === 'ekle'
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-white hover:bg-red-100 text-red-700 border border-red-300'
            }
            bekliyor={kaydediliyor}
            onGonder={(adet) =>
              mod === 'ekle' ? serbestKaydet('misafir', adet) : serbestGeriAl('misafir', adet)
            }
          />
        </div>
      </div>

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

/**
 * Serbest öğün girişi: adet + birim fiyat.
 *
 * Fiyat seçili günün tarifesinden hazır gelir; o işlem için değiştirilebilir,
 * tarife değişmez.
 */
function SerbestGiris({
  etiket,
  renk,
  varsayilanFiyat,
  bekliyor,
  onGonder,
}: {
  etiket: string
  renk: string
  /** Verilmezse fiyat kutusu çıkmaz (misafir gibi ücretsiz öğünler) */
  varsayilanFiyat?: number
  bekliyor: boolean
  onGonder: (adet: number, fiyat?: number) => void
}) {
  const fiyatliMi = varsayilanFiyat !== undefined
  const [adet, setAdet] = useState('1')
  const [fiyat, setFiyat] = useState(
    fiyatliMi ? String(varsayilanFiyat).replace('.', ',') : '',
  )

  const sayi = Math.min(500, Math.max(1, Number(adet) || 1))
  const fiyatSayi = Number(fiyat.replace(/\./g, '').replace(',', '.'))
  const gecerli = !fiyatliMi || (fiyat.trim() !== '' && Number.isFinite(fiyatSayi) && fiyatSayi >= 0)
  const degistirildi = fiyatliMi && gecerli && fiyatSayi !== varsayilanFiyat

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-solgun">
        <span className="block">Adet</span>
        <input
          type="number"
          min={1}
          max={500}
          value={adet}
          onChange={(e) => setAdet(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-16 rounded border border-cizgi bg-white px-2 py-1.5 text-center
                     text-sm font-medium text-metin tabular-nums outline-none
                     focus:border-vurgu focus:ring-2 focus:ring-blue-100"
        />
      </label>
      {fiyatliMi && (
        <label className="text-xs text-solgun">
          <span className="block">Birim ₺</span>
          <input
            inputMode="decimal"
            value={fiyat}
            onChange={(e) => setFiyat(e.target.value)}
            onFocus={(e) => e.target.select()}
            className={`w-24 rounded border bg-white px-2 py-1.5 text-center text-sm
                        font-medium tabular-nums outline-none focus:ring-2 focus:ring-blue-100
                        ${
                          !gecerli
                            ? 'border-red-400 text-red-700'
                            : degistirildi
                              ? 'border-amber-400 text-amber-800'
                              : 'border-cizgi text-metin'
                        }`}
          />
        </label>
      )}
      <button
        type="button"
        disabled={bekliyor || !gecerli}
        onClick={() => onGonder(sayi, fiyatliMi ? fiyatSayi : undefined)}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition
                    disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white ${renk}`}
      >
        {etiket}
      </button>
      {degistirildi && (
        <span className="self-center text-xs text-amber-700">
          tarife {para(varsayilanFiyat!)}
        </span>
      )}
    </div>
  )
}
