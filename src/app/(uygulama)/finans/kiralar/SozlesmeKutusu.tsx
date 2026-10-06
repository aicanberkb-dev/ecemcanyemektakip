'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { tarih as tarihBicim } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/client'

import {
  boyutYazi,
  dosyaAdiTemizle,
  OKUL_KLASORU,
  SOZLESME_KOVASI,
  type SozlesmeDosyasi,
} from './sozlesme'

/**
 * Okulun kira sözleşmeleri: yükle, aç, indir, sil.
 *
 * Dosyalar tarayıcıdan doğrudan Supabase'e gidiyor — sunucu üzerinden
 * geçirilseydi taranmış PDF'ler (50 MB'a varıyor) istek sınırına takılırdı.
 * Listeleme ve imzalı bağlantılar sunucu tarafında üretiliyor.
 */
export function SozlesmeKutusu({
  okulAdi,
  dosyalar,
}: {
  okulAdi: string
  dosyalar: SozlesmeDosyasi[]
}) {
  const router = useRouter()
  const [acik, setAcik] = useState(false)
  const [calisiyor, setCalisiyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const girdiRef = useRef<HTMLInputElement>(null)

  const klasor = OKUL_KLASORU[okulAdi]

  async function yukle(dosyaListesi: FileList | null) {
    if (!dosyaListesi || dosyaListesi.length === 0 || !klasor) return

    setCalisiyor(true)
    setHata(null)
    const supabase = supabaseBrowser()

    for (const dosya of Array.from(dosyaListesi)) {
      const yol = `${klasor}/${dosyaAdiTemizle(dosya.name)}`
      // upsert: aynı adlı dosyayı yeniden yüklemek güncelleme sayılsın,
      // "zaten var" hatası alıp ne yapacağını düşünmek zorunda kalmasın
      const { error } = await supabase.storage
        .from(SOZLESME_KOVASI)
        .upload(yol, dosya, { upsert: true, contentType: dosya.type || undefined })

      if (error) {
        setHata(`${dosya.name}: ${error.message}`)
        break
      }
    }

    if (girdiRef.current) girdiRef.current.value = ''
    setCalisiyor(false)
    router.refresh()
  }

  async function sil(d: SozlesmeDosyasi) {
    if (!confirm(`${d.ad} silinecek. Emin misin?`)) return

    setCalisiyor(true)
    setHata(null)
    const supabase = supabaseBrowser()
    const { error } = await supabase.storage.from(SOZLESME_KOVASI).remove([d.yol])
    if (error) setHata(error.message)
    setCalisiyor(false)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => setAcik(!acik)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span>{acik ? '▾' : '▸'}</span>
        <span>Kira Sözleşmeleri</span>
        <span className="ml-auto font-normal text-solgun">
          {dosyalar.length > 0 ? `${dosyalar.length} dosya` : 'dosya yok'}
        </span>
      </button>

      {acik && (
        <div className="space-y-2 border-t border-slate-300 p-3">
          {hata && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{hata}</p>}

          {dosyalar.length === 0 ? (
            <p className="text-xs text-solgun">Bu okul için yüklenmiş sözleşme yok.</p>
          ) : (
            <ul className="space-y-1">
              {dosyalar.map((d) => (
                <li
                  key={d.yol}
                  className="flex flex-wrap items-center gap-2 rounded border border-cizgi px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate font-medium" title={d.ad}>
                    {d.ad}
                  </span>
                  <span className="shrink-0 text-[11px] text-solgun">
                    {boyutYazi(d.boyut)}
                    {d.yuklenme ? ` · ${tarihBicim(d.yuklenme)}` : ''}
                  </span>

                  {d.baglanti && (
                    <>
                      <a
                        href={d.baglanti}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 font-semibold text-vurgu hover:underline"
                      >
                        Aç
                      </a>
                      <a
                        href={`${d.baglanti}&download=${encodeURIComponent(d.ad)}`}
                        className="shrink-0 font-semibold text-vurgu hover:underline"
                      >
                        İndir
                      </a>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={calisiyor}
                    onClick={() => sil(d)}
                    className="shrink-0 text-solgun hover:text-red-700 disabled:opacity-40"
                    aria-label={`${d.ad} dosyasını sil`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              ref={girdiRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              disabled={calisiyor || !klasor}
              onChange={(e) => yukle(e.target.files)}
              className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-900 disabled:opacity-40"
            />
            {calisiyor && <span className="text-xs text-solgun">yükleniyor…</span>}
          </div>

          <p className="text-[11px] text-solgun">
            PDF, Word ve fotoğraf; dosya başına en çok 60 MB. Aynı adlı dosyayı yeniden
            yüklersen eskisinin üzerine yazar.
          </p>
        </div>
      )}
    </div>
  )
}
