'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { para } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'

import { dekontKaydet } from './actions'
import { DEKONT_KOVASI } from './dekont'
import { KALEM_ADLARI, KALEM_SIRASI, type Kalem } from './kalemler'
import { dosyaAdiTemizle } from './sozlesme'

/** Panelde seçilebilen bir taksit satırı */
export type SecilebilirSatir = {
  id: string
  kalem: Kalem
  sira: number
  tutar: number
  /** Zaten bir dekonta bağlıysa o dekontun rozet kodu */
  dekontKodu: string | null
}

/**
 * Dekont yükleme paneli.
 *
 * Bir dekont birden fazla taksiti kapsayabildiği için dosya ile birlikte
 * "bu dekont hangi taksitleri kapsıyor" sorusu da soruluyor. Tek taksit de
 * seçilebilir; fark yalnızca kaç kutucuk işaretlendiğinde.
 *
 * Dosya tarayıcıdan doğrudan Supabase'e gidiyor: sunucu eylemlerinin gövde
 * sınırı küçük, telefonla çekilmiş dekont fotoğrafı oraya sığmıyor.
 */
export function DekontPaneli({
  birim,
  klasor,
  satirlar,
  bugun,
  kapat,
}: {
  birim: string
  klasor: string
  satirlar: SecilebilirSatir[]
  bugun: string
  kapat: () => void
}) {
  const router = useRouter()
  const [bekliyor, basla] = useTransition()
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [dosya, setDosya] = useState<File | null>(null)
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [tarih, setTarih] = useState(bugun)
  const [tutar, setTutar] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [odendiIsaretle, setOdendiIsaretle] = useState(true)
  const girdiRef = useRef<HTMLInputElement>(null)

  const kalemler = KALEM_SIRASI.map((k) => ({
    kalem: k,
    satirlar: satirlar.filter((s) => s.kalem === k).sort((a, b) => a.sira - b.sira),
  })).filter((g) => g.satirlar.length > 0)

  const seciliSatirlar = satirlar.filter((s) => secili.has(s.id))
  const seciliToplam = seciliSatirlar.reduce((t, s) => t + s.tutar, 0)
  const dekontTutari = Number(tutar.replace(/\./g, '').replace(',', '.'))
  const tutarGirildi = tutar.trim() !== '' && Number.isFinite(dekontTutari)
  // Kuruş farkı tolere ediliyor: banka yuvarlamaları yüzünden birebir
  // tutmayan ama doğru olan dekontlar uyarı almasın.
  const uyusuyor = tutarGirildi && Math.abs(dekontTutari - seciliToplam) < 0.02

  function degistir(id: string) {
    setSecili((eski) => {
      const yeni = new Set(eski)
      if (yeni.has(id)) yeni.delete(id)
      else yeni.add(id)
      return yeni
    })
  }

  function kalemSec(grupSatirlari: SecilebilirSatir[]) {
    const secilebilir = grupSatirlari.filter((s) => !s.dekontKodu)
    const hepsiSecili = secilebilir.every((s) => secili.has(s.id))
    setSecili((eski) => {
      const yeni = new Set(eski)
      for (const s of secilebilir) {
        if (hepsiSecili) yeni.delete(s.id)
        else yeni.add(s.id)
      }
      return yeni
    })
  }

  async function kaydet() {
    if (!dosya) {
      setHata('Önce dekont dosyasını seçin.')
      return
    }
    if (secili.size === 0) {
      setHata('Dekontun kapsadığı en az bir taksit seçilmeli.')
      return
    }

    setHata(null)
    setYukleniyor(true)

    // Dosya adının başına zaman damgası: aynı adlı iki dekont birbirini
    // ezmesin, her yükleme ayrı bir belge olsun.
    const damga = Date.now()
    const yol = `${klasor}/${damga}-${dosyaAdiTemizle(dosya.name)}`
    const supabase = supabaseBrowser()
    const { error } = await supabase.storage
      .from(DEKONT_KOVASI)
      .upload(yol, dosya, { contentType: dosya.type || undefined })

    setYukleniyor(false)
    if (error) {
      setHata(error.message)
      return
    }

    basla(async () => {
      const sonuc = await dekontKaydet({
        birim,
        dosyaYolu: yol,
        dosyaAdi: dosya.name,
        odemeTarihi: tarih || null,
        tutar: tutarGirildi ? dekontTutari : null,
        aciklama: aciklama.trim() || null,
        kiraIdleri: [...secili],
        odendiIsaretle,
      })

      if (sonuc.hata) {
        // Kayıt tutmadıysa yüklenen dosya kovada çöp olarak kalmasın
        await supabase.storage.from(DEKONT_KOVASI).remove([yol])
        setHata(sonuc.hata)
        return
      }

      router.refresh()
      kapat()
    })
  }

  const calisiyor = yukleniyor || bekliyor

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/40 p-4">
      <div className="my-auto w-full max-w-xl rounded-lg border border-cizgi bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-cizgi px-4 py-3">
          <h2 className="text-sm font-bold">Dekont Yükle</h2>
          <span className="text-[11px] text-solgun">{birim}</span>
          <button
            type="button"
            onClick={kapat}
            aria-label="Kapat"
            className="ml-auto px-1 text-lg leading-none text-solgun hover:text-slate-900"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 border-b border-cizgi px-4 py-3">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-700">Dekont dosyası</span>
            <button
              type="button"
              onClick={() => girdiRef.current?.click()}
              className="mt-1 flex w-full items-center gap-3 rounded-md border border-dashed border-indigo-300 bg-indigo-50 px-3 py-3 text-left hover:bg-indigo-100"
            >
              <span className="text-xl leading-none text-indigo-700" aria-hidden="true">
                ⬆
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-indigo-900">
                  {dosya ? dosya.name : 'Dosya seç (PDF veya fotoğraf)'}
                </span>
                <span className="block text-[11px] text-solgun">
                  {dosya ? 'değiştirmek için tıkla' : 'en çok 20 MB'}
                </span>
              </span>
            </button>
            <input
              ref={girdiRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-[11px] font-semibold text-slate-700">Ödeme tarihi</span>
              <input
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="girdi mt-1 w-full !py-1.5 text-xs"
              />
            </label>
            <label className="w-40">
              <span className="text-[11px] font-semibold text-slate-700">Dekont tutarı</span>
              <input
                inputMode="decimal"
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
                placeholder="31.067,96"
                className="girdi mt-1 w-full !py-1.5 text-right text-xs tabular-nums"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-slate-700">
              Açıklama <span className="font-normal text-solgun">(isteğe bağlı)</span>
            </span>
            <input
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              placeholder="Ekim ödemesi, 2–5. taksit birlikte"
              className="girdi mt-1 w-full !py-1.5 text-xs"
            />
          </label>
        </div>

        <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
          <h3 className="text-xs font-bold">Bu dekont hangi taksitleri kapsıyor?</h3>
          <span className="text-[11px] text-solgun">tek taksit de seçebilirsin</span>
        </div>

        <div className="max-h-72 space-y-2 overflow-auto px-4 pb-2">
          {kalemler.map((g) => (
            <div key={g.kalem} className="overflow-hidden rounded-md border border-cizgi">
              <div className="flex items-center gap-2 border-b border-cizgi bg-slate-50 px-2.5 py-1.5">
                <span className="text-xs font-semibold">{KALEM_ADLARI[g.kalem]}</span>
                <button
                  type="button"
                  onClick={() => kalemSec(g.satirlar)}
                  className="ml-auto text-[11px] font-semibold text-indigo-700 hover:underline"
                >
                  Tümünü seç
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-4">
                {g.satirlar.map((s) => {
                  const kilit = !!s.dekontKodu
                  const isaretli = secili.has(s.id)
                  return (
                    <label
                      key={s.id}
                      title={kilit ? `Bu taksitte ${s.dekontKodu} var` : undefined}
                      className={`flex items-center gap-1.5 rounded border px-1.5 py-1 ${
                        kilit
                          ? 'cursor-not-allowed border-cizgi bg-slate-50 text-slate-400'
                          : isaretli
                            ? 'cursor-pointer border-indigo-300 bg-indigo-50'
                            : 'cursor-pointer border-cizgi bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={kilit}
                        checked={isaretli}
                        onChange={() => degistir(s.id)}
                        className="accent-indigo-600"
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block text-[11px] font-semibold">{s.sira}. Taksit</span>
                        <span className="block text-[10px] text-solgun tabular-nums">
                          {kilit ? s.dekontKodu : para(s.tutar)}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {kalemler.length === 0 && (
            <p className="py-4 text-center text-xs text-solgun">
              Bu birimde henüz taksit kaydı yok. Önce tutarları girin.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-cizgi bg-slate-50 px-4 py-3">
          {secili.size > 0 && (
            <p
              className={`rounded-md border px-2.5 py-2 text-[11px] ${
                !tutarGirildi
                  ? 'border-cizgi bg-white text-slate-700'
                  : uyusuyor
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {secili.size} taksit seçildi · toplam{' '}
              <strong className="tabular-nums">{para(seciliToplam)}</strong>
              {tutarGirildi &&
                (uyusuyor
                  ? ' — dekont tutarıyla uyuşuyor'
                  : ` — dekont tutarı ${para(dekontTutari)}, aradaki fark ${para(
                      Math.abs(dekontTutari - seciliToplam),
                    )}`)}
            </p>
          )}

          {hata && (
            <p className="rounded-md bg-red-50 px-2.5 py-2 text-[11px] text-red-700">{hata}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={odendiIsaretle}
                onChange={(e) => setOdendiIsaretle(e.target.checked)}
                className="accent-emerald-600"
              />
              Seçilen taksitleri ödendi olarak işaretle
            </label>
            <button
              type="button"
              onClick={kapat}
              disabled={calisiyor}
              className="ml-auto rounded-md border border-cizgi bg-white px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={kaydet}
              disabled={calisiyor}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {calisiyor ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
