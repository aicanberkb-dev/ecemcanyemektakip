'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TaksitRozeti, type TaksitBilgisi } from '@/components/TaksitRozeti'
import { bugunISO, para } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { GunSonu, PosSonuc, SerbestOgunTipi } from '@/lib/types'

type Mesaj = { tip: 'ok' | 'hata'; metin: string }

export function PosEkrani({
  okulId,
  okulAdi,
  ucretliVarsayilan,
  taksitler,
}: {
  okulId: string
  okulAdi: string
  /** Bugünkü tarifeden gelen ücretli öğün fiyatı; ekranda değiştirilebilir */
  ucretliVarsayilan: number
  /** Aylıkçıların taksit durumu, öğrenci id'siyle */
  taksitler: Record<string, TaksitBilgisi>
}) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const aramaRef = useRef<HTMLInputElement>(null)

  const [terim, setTerim] = useState('')
  const [sonuclar, setSonuclar] = useState<PosSonuc[]>([])
  const [vurgulu, setVurgulu] = useState(0)
  const [secili, setSecili] = useState<PosSonuc | null>(null)
  const [mesaj, setMesaj] = useState<Mesaj | null>(null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [ozet, setOzet] = useState<GunSonu | null>(null)
  // Her serbest öğün kaydından sonra artar; adet ve fiyat kutularını
  // varsayılana döndürmek için AdetliButon'a key olarak verilir.
  const [sifirlama, setSifirlama] = useState(0)

  const odakla = useCallback(() => {
    aramaRef.current?.focus()
    aramaRef.current?.select()
  }, [])

  const ozetYenile = useCallback(async () => {
    const { data } = await supabase.rpc('gun_sonu', { p_okul_id: okulId })
    if (data?.[0]) setOzet(data[0] as GunSonu)
  }, [supabase, okulId])

  // İlk açılışta bugünün sayacını çek ve odağı arama kutusuna ver.
  // Okul değişince bileşen key ile yeniden kurulur (bkz. pos/page.tsx).
  useEffect(() => {
    let iptal = false
    supabase.rpc('gun_sonu', { p_okul_id: okulId }).then(({ data }) => {
      if (!iptal && data?.[0]) setOzet(data[0] as GunSonu)
    })
    aramaRef.current?.focus()
    return () => {
      iptal = true
    }
  }, [supabase, okulId])

  // --- Canlı arama (harfe göre) -------------------------------------------
  useEffect(() => {
    const t = terim.trim()
    if (secili || t === '') return

    let iptal = false
    const zamanlayici = setTimeout(async () => {
      const { data, error } = await supabase.rpc('pos_ara', {
        p_okul_id: okulId,
        p_terim: t,
      })
      if (iptal) return
      if (error) {
        setMesaj({ tip: 'hata', metin: error.message })
        return
      }
      const liste = (data ?? []) as PosSonuc[]

      // Kart okutuldu: numara/kimlik tam eşleşti ve tek sonuç var → otomatik seç
      if (liste.length === 1 && liste[0].tam_eslesme) {
        setSecili(liste[0])
        setSonuclar([])
        setVurgulu(0)
        return
      }

      setSonuclar(liste)
      setVurgulu(0)
    }, 140)

    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [terim, secili, supabase, okulId])

  // Öğrenci seçiliyse ya da kutu boşsa liste kapalı — türetilmiş, effect gerekmez
  const gosterilen = secili || terim.trim() === '' ? [] : sonuclar

  function sec(ogrenci: PosSonuc) {
    setSecili(ogrenci)
    setSonuclar([])
    setTerim('')
  }

  function vazgec() {
    setSecili(null)
    setTerim('')
    setSonuclar([])
    setVurgulu(0)
    setMesaj(null)
    odakla()
  }

  function tusla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      vazgec()
      return
    }
    if (gosterilen.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setVurgulu((i) => (i + 1) % gosterilen.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setVurgulu((i) => (i - 1 + gosterilen.length) % gosterilen.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      sec(gosterilen[vurgulu])
    }
  }

  // --- Kayıt ---------------------------------------------------------------
  async function yemekKaydet() {
    if (!secili || kaydediliyor) return
    setKaydediliyor(true)
    const ad = secili.ad_soyad

    const { error } = await supabase.rpc('yemek_kaydet', { p_student_id: secili.student_id })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    setMesaj({
      tip: 'ok',
      metin:
        secili.abone_tipi === 'aylik'
          ? `${ad} — devam kaydı alındı.`
          : `${ad} — ${para(secili.gunluk_ucret)} düşüldü.`,
    })
    vazgec()
    ozetYenile()
  }

  /** Öğrencinin bugünkü yemek kaydını siler — o gün gelmemiş sayılır. */
  async function yemekGeriAl() {
    if (!secili || kaydediliyor) return
    if (!confirm(`${secili.ad_soyad} bugün yemek yememiş olarak işaretlensin mi?`)) return

    setKaydediliyor(true)
    const ad = secili.ad_soyad
    const { error } = await supabase.rpc('yemek_geri_al', { p_student_id: secili.student_id })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    setMesaj({ tip: 'ok', metin: `${ad} — yemek kaydı geri alındı.` })
    vazgec()
    ozetYenile()
  }

  async function serbestKaydet(tip: SerbestOgunTipi, adet: number, birim?: number) {
    if (kaydediliyor) return
    setKaydediliyor(true)

    // Fiyat girilmemişse sunucu o günün tarifesini uygular.
    const { data, error } = await supabase.rpc('serbest_ogun_kaydet', {
      p_okul_id: okulId,
      p_tip: tip,
      p_adet: adet,
      p_birim_tutar: Number.isFinite(birim) ? birim : null,
    })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    const sonuc = (data as { eklenen: number; gun_toplami: number; birim_tutar: number }[] | null)?.[0]
    const ad = tip === 'ucretli' ? 'Ücretli' : 'Misafir'
    setMesaj({
      tip: 'ok',
      metin:
        `${ad}: ${sonuc?.eklenen ?? adet} kayıt eklendi` +
        `${Number(sonuc?.birim_tutar ?? 0) > 0 ? ` (birim ${para(sonuc!.birim_tutar)})` : ''}` +
        ` — bugün toplam ${sonuc?.gun_toplami ?? '?'}.`,
    })
    setSifirlama((n) => n + 1)
    vazgec()
    ozetYenile()
  }

  async function serbestGeriAl(tip: SerbestOgunTipi, adet: number, birim?: number) {
    if (kaydediliyor) return
    const ad = tip === 'ucretli' ? 'ücretli' : 'misafir'
    const fiyatli = Number.isFinite(birim)
    if (
      !confirm(
        `${adet} adet ${ad} öğün kaydı silinsin mi?` +
          (fiyatli ? `\nBirim ${para(birim!)} — toplam ${para(adet * birim!)} iade edilecek.` : ''),
      )
    )
      return

    setKaydediliyor(true)
    // Tutar verilirse yalnızca o fiyattan girilmiş kayıtlar geri alınır;
    // yetmezse sunucu hata verir, sessizce başka tutar silinmez.
    const { data, error } = await supabase.rpc('serbest_ogun_geri_al', {
      p_okul_id: okulId,
      p_tip: tip,
      p_adet: adet,
      p_birim_tutar: fiyatli ? birim : null,
    })

    setKaydediliyor(false)
    if (error) {
      setMesaj({ tip: 'hata', metin: error.message })
      return
    }
    const sonuc = (data as { silinen: number; gun_toplami: number; iade_tutari: number }[] | null)?.[0]
    setMesaj({
      tip: 'ok',
      metin:
        `${tip === 'ucretli' ? 'Ücretli' : 'Misafir'}: ${sonuc?.silinen ?? adet} kayıt geri alındı` +
        `${Number(sonuc?.iade_tutari ?? 0) > 0 ? ` (${para(sonuc!.iade_tutari)} iade)` : ''}` +
        ` — bugün toplam ${sonuc?.gun_toplami ?? '?'}.`,
    })
    setSifirlama((n) => n + 1)
    vazgec()
    ozetYenile()
  }

  const yemekKilitli = !secili || secili.bugun_yedi || kaydediliyor

  // Yemekhane hep "bugün"e kaydeder; hafta sonu okul olmadığı için o gün
  // girilen kayıt neredeyse her zaman hatadır. Engellenmiyor, uyarılıyor.
  const haftaSonu = [0, 6].includes(new Date(`${bugunISO()}T00:00:00`).getDay())

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {haftaSonu && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Bugün hafta sonu — okul yok. Kayıt girebilirsiniz ama bu gün maliyet ve
            kâr/zarar hesabına girmez.
          </p>
        )}

        {/* Arama */}
        <div className="kart relative p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label className="etiket !mb-0" htmlFor="arama">
              Öğrenci no, kimlik no veya isim
            </label>
            <span className="rozet bg-blue-100 text-blue-800">{okulAdi}</span>
          </div>
          <input
            id="arama"
            ref={aramaRef}
            value={secili ? '' : terim}
            onChange={(e) => setTerim(e.target.value)}
            onKeyDown={tusla}
            disabled={!!secili}
            autoComplete="off"
            placeholder="Yazın ya da kart okutun…"
            className="girdi !py-3 !text-lg"
          />

          {gosterilen.length > 0 && (
            <ul className="absolute inset-x-4 top-full z-20 mt-1 max-h-80 overflow-auto rounded-md border border-cizgi bg-white shadow-lg">
              {gosterilen.map((o, i) => (
                <li key={o.student_id}>
                  <button
                    type="button"
                    onMouseEnter={() => setVurgulu(i)}
                    onClick={() => sec(o)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                      i === vurgulu ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="flex-1">
                      <span className="font-medium">{o.ad_soyad}</span>
                      <span className="ml-2 text-xs text-solgun">
                        {o.ogrenci_no}
                        {o.sinif ? ` · ${o.sinif}` : ''}
                      </span>
                    </span>
                    {o.bugun_yedi && (
                      <span className="rozet bg-slate-100 text-slate-600">bugün yedi</span>
                    )}
                    {o.abone_tipi === 'aylik' ? (
                      <TaksitRozeti taksit={taksitler[o.student_id]} tutarGoster={false} />
                    ) : (
                      <span
                        className={`font-semibold tabular-nums ${
                          o.kalan < 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {para(o.kalan)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Seçili öğrenci */}
        <div className="kart flex min-h-44 flex-col items-center justify-center p-6 text-center">
          {secili ? (
            <>
              <p className="text-3xl font-bold">{secili.ad_soyad}</p>
              <p className="mt-1 text-sm text-solgun">
                {secili.ogrenci_no}
                {secili.sinif ? ` · ${secili.sinif}` : ''} ·{' '}
                {secili.abone_tipi === 'aylik' ? 'Aylıkçı' : 'Günlükçü'}
              </p>

              {/* Aylıkçıda bakiye ödeme durumunu göstermez; ölçü taksit planı.
                  Büyük rakam yerine taksit durumu öne çıkar. */}
              {secili.abone_tipi === 'aylik' ? (
                <>
                  <div className="mt-4">
                    <TaksitRozeti taksit={taksitler[secili.student_id]} />
                  </div>
                  {(() => {
                    const t = taksitler[secili.student_id]
                    if (!t || t.yillik_toplam === 0) return null
                    return (
                      <p className="mt-2 text-sm text-solgun tabular-nums">
                        Vadesi gelen {para(t.vadesi_gelen)} · ödenen {para(t.odenen)}
                        {t.eksik > 0 && (
                          <span className="ml-1 font-semibold text-red-600">
                            · eksik {para(t.eksik)}
                          </span>
                        )}
                      </p>
                    )
                  })()}
                </>
              ) : (
                <p
                  className={`mt-4 text-6xl font-bold tabular-nums ${
                    secili.kalan < 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {para(secili.kalan)}
                </p>
              )}
              {secili.bugun_yedi ? (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                  Bugün zaten yemek kaydı var.
                </p>
              ) : (
                <p className="mt-3 text-sm text-solgun">
                  {secili.abone_tipi === 'aylik'
                    ? 'Aylıkçı — devam kaydı düşer, ücret alınmaz.'
                    : `Düşülecek: ${para(secili.gunluk_ucret)}`}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg text-slate-400">Öğrenci seçilmedi</p>
          )}
        </div>

        {/* Kayıt butonları — abone tipini öğrencinin verisinden biliyoruz,
            kullanıcıya seçtirmiyoruz */}
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <OgunButonu
            renk="bg-blue-600 hover:bg-blue-700"
            etkin={!yemekKilitli}
            vurgulu={!!secili && !secili.bugun_yedi}
            onClick={yemekKaydet}
          >
            Öğrenci Yemek Yedir
          </OgunButonu>

          {/* key: her kayıttan sonra bileşen sıfırlanır — fiyat tarifeye,
              adet 1'e döner. Değiştirilmiş fiyatın sonraki işlemde de
              kullanılması sessiz bir hataya yol açıyordu. */}
          <AdetliButon
            key={`ucretli-${sifirlama}`}
            renk="bg-yellow-400 hover:bg-yellow-500"
            metinRengi="text-slate-900"
            etkin={!kaydediliyor}
            varsayilanFiyat={ucretliVarsayilan}
            onGonder={(adet, fiyat) => serbestKaydet('ucretli', adet, fiyat)}
          >
            Ücretli
          </AdetliButon>

          {/* Misafir personelimiz: ücret alınmıyor, buton yalnızca sayaç.
              Bu yüzden fiyat kutusu yok. */}
          <AdetliButon
            key={`misafir-${sifirlama}`}
            renk="bg-purple-600 hover:bg-purple-700"
            etkin={!kaydediliyor}
            onGonder={(adet) => serbestKaydet('misafir', adet)}
          >
            Misafir
          </AdetliButon>

          <OgunButonu renk="bg-slate-500 hover:bg-slate-600" etkin onClick={vazgec}>
            Vazgeç
          </OgunButonu>
        </div>

        {/* Geri alma barı — yanlışlıkla basılmasın diye ayrı ve uzakta */}
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50/50 p-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-red-800 uppercase">
            Geri alma — yanlış girilen kayıtları siler
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={!secili || kaydediliyor}
              onClick={yemekGeriAl}
              className="rounded-md border border-red-300 bg-white px-3 py-3 text-sm font-medium
                         text-red-700 transition hover:bg-red-100
                         disabled:cursor-not-allowed disabled:border-cizgi
                         disabled:bg-slate-100 disabled:text-slate-400"
            >
              Öğrenci Yemek Geri Al
              {!secili && <span className="mt-0.5 block text-xs">önce öğrenci seçin</span>}
            </button>

            {/* Fiyat kutusu burada da var: taban dışı bir tutardan tahsilat
                yapıldıysa iadesi de o tutardan olmalı. key ile her işlemden
                sonra tabana döner. */}
            <AdetliButon
              key={`ucretli-geri-${sifirlama}`}
              renk="bg-white hover:bg-red-100"
              metinRengi="text-red-700"
              kenarlik="border border-red-300"
              etkin={!kaydediliyor}
              kucuk
              varsayilanFiyat={ucretliVarsayilan}
              onGonder={(adet, fiyat) => serbestGeriAl('ucretli', adet, fiyat)}
            >
              Ücretli Geri Al
            </AdetliButon>

            <AdetliButon
              key={`misafir-geri-${sifirlama}`}
              renk="bg-white hover:bg-red-100"
              metinRengi="text-red-700"
              kenarlik="border border-red-300"
              etkin={!kaydediliyor}
              kucuk
              onGonder={(adet) => serbestGeriAl('misafir', adet)}
            >
              Misafir Geri Al
            </AdetliButon>
          </div>
        </div>

        {mesaj && (
          <p
            className={`rounded-md px-4 py-3 text-sm font-medium ${
              mesaj.tip === 'ok'
                ? 'bg-emerald-50 text-emerald-800'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {mesaj.metin}
          </p>
        )}
      </div>

      {/* Bugünün sayacı */}
      <aside className="kart h-fit p-4">
        <h2 className="mb-3 text-sm font-semibold text-solgun uppercase">Bugün</h2>
        <dl className="space-y-2 text-sm">
          <Satir ad="Günlükçü" deger={ozet?.gunlukcu ?? 0} />
          <Satir ad="Aylıkçı" deger={ozet?.aylikci ?? 0} />
          <Satir ad="Ücretli" deger={ozet?.ucretli ?? 0} />
          <Satir ad="Misafir" deger={ozet?.misafir ?? 0} />
          <div className="border-t border-cizgi pt-2">
            <Satir ad="Toplam" deger={ozet?.toplam ?? 0} kalin />
          </div>
          <div className="border-t border-cizgi pt-2 text-xs text-solgun">
            Kasaya giren (ücretli): {para(ozet?.ucretli_tutar ?? 0)}
          </div>
        </dl>
      </aside>
    </div>
  )
}

/**
 * Adet kutulu buton: varsayılan 1, elle değiştirilebilir.
 * "Yemekten sonra 3 kişi ücretli yedi" gibi toplu girişler için.
 *
 * `varsayilanFiyat` verilirse birim fiyat kutusu da çıkar: tarifedeki fiyat
 * hazır gelir, gerekirse o işlem için değiştirilir. Tarife değişmez.
 */
function AdetliButon({
  children,
  renk,
  metinRengi = 'text-white',
  kenarlik = '',
  etkin,
  kucuk,
  varsayilanFiyat,
  onGonder,
}: {
  children: React.ReactNode
  renk: string
  metinRengi?: string
  kenarlik?: string
  etkin: boolean
  kucuk?: boolean
  varsayilanFiyat?: number
  onGonder: (adet: number, fiyat?: number) => void
}) {
  const [adet, setAdet] = useState('1')
  const [fiyat, setFiyat] = useState(
    varsayilanFiyat === undefined ? '' : String(varsayilanFiyat).replace('.', ','),
  )
  const sayi = Math.min(500, Math.max(1, Number(adet) || 1))

  // Türkçe virgüllü giriş kabul edilir
  const fiyatSayi = Number(fiyat.replace(/\./g, '').replace(',', '.'))
  const fiyatGecerli = fiyat.trim() !== '' && Number.isFinite(fiyatSayi) && fiyatSayi >= 0
  const degistirildi =
    varsayilanFiyat !== undefined && fiyatGecerli && fiyatSayi !== varsayilanFiyat

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!etkin || (varsayilanFiyat !== undefined && !fiyatGecerli)}
        onClick={() => onGonder(sayi, varsayilanFiyat === undefined ? undefined : fiyatSayi)}
        className={`rounded-lg px-3 font-semibold transition
          ${kucuk ? 'py-3 text-sm' : 'py-6 text-base'}
          disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white
          ${renk} ${kenarlik} ${etkin ? metinRengi : ''}`}
      >
        {children}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-solgun">
          <span>Adet</span>
          <input
            type="number"
            min={1}
            max={500}
            value={adet}
            onChange={(e) => setAdet(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="w-16 rounded border border-cizgi bg-white px-2 py-1 text-center
                       text-sm font-medium text-metin tabular-nums outline-none
                       focus:border-vurgu focus:ring-2 focus:ring-blue-100"
          />
        </label>
        {varsayilanFiyat !== undefined && (
          <label className="flex items-center gap-1.5 text-xs text-solgun">
            <span>Fiyat ₺</span>
            <input
              inputMode="decimal"
              value={fiyat}
              onChange={(e) => setFiyat(e.target.value)}
              onFocus={(e) => e.target.select()}
              className={`w-20 rounded border bg-white px-2 py-1 text-center text-sm
                          font-medium tabular-nums outline-none focus:ring-2 focus:ring-blue-100
                          ${
                            !fiyatGecerli
                              ? 'border-red-400 text-red-700'
                              : degistirildi
                                ? 'border-amber-400 text-amber-800'
                                : 'border-cizgi text-metin'
                          }`}
            />
          </label>
        )}
      </div>
      {degistirildi && (
        <p className="text-xs text-amber-700">
          Tarife {para(varsayilanFiyat)} — bu işlem için değiştirildi
        </p>
      )}
    </div>
  )
}

function OgunButonu({
  children,
  renk,
  metinRengi = 'text-white',
  etkin,
  vurgulu,
  onClick,
}: {
  children: React.ReactNode
  renk: string
  /** Açık zeminli butonlarda okunabilirlik için koyu metin verilir. */
  metinRengi?: string
  etkin: boolean
  vurgulu?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!etkin}
      onClick={onClick}
      className={`rounded-lg px-3 py-6 text-base font-semibold transition
        disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white
        ${renk} ${etkin ? metinRengi : ''}
        ${vurgulu && etkin ? 'ring-4 ring-offset-2 ring-blue-200' : ''}`}
    >
      {children}
    </button>
  )
}

function Satir({ ad, deger, kalin }: { ad: string; deger: number; kalin?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={kalin ? 'font-semibold' : 'text-solgun'}>{ad}</dt>
      <dd className={`tabular-nums ${kalin ? 'text-xl font-bold' : 'font-medium'}`}>
        {deger}
      </dd>
    </div>
  )
}
