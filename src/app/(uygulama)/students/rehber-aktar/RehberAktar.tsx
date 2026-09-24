'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import {
  eslestir,
  rehberOku,
  type Eslesme,
  type EslestirmeGirdisi,
} from '@/lib/rehber-eslestir'

import { telefonlariYaz } from './actions'

const SEBEP_ROZET: Record<Eslesme['sebep'], { ad: string; sinif: string }> = {
  ogrenci: { ad: 'Öğrenci adı tuttu', sinif: 'bg-emerald-100 text-emerald-800' },
  veli: { ad: 'Veli adı tuttu', sinif: 'bg-blue-100 text-blue-800' },
  soyad: { ad: 'Sadece soyad', sinif: 'bg-amber-100 text-amber-800' },
}

export function RehberAktar({
  okulAdi,
  eksikler,
  toplam,
}: {
  okulAdi: string
  eksikler: EslestirmeGirdisi[]
  toplam: number
}) {
  const router = useRouter()
  const [rehberSayisi, setRehberSayisi] = useState<number | null>(null)
  const [eslesmeler, setEslesmeler] = useState<Eslesme[] | null>(null)
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)

  async function dosyaSecildi(dosya: File) {
    setMesaj(null)
    const metin = await dosya.text()
    const kisiler = rehberOku(dosya.name, metin)
    setRehberSayisi(kisiler.length)

    if (kisiler.length === 0) {
      setEslesmeler([])
      setMesaj({
        tip: 'hata',
        metin:
          'Dosyada cep numarası bulunamadı. Google Kişiler’den "vCard" ya da "Google CSV" olarak dışa aktardığınızdan emin olun.',
      })
      return
    }

    const bulunan = eslestir(eksikler, kisiler)
    setEslesmeler(bulunan)
    // Güvenli olanlar hazır işaretli gelir; "sadece soyad" ve rakipli olanlar gelmez
    setSecili(
      new Set(
        bulunan
          .filter((e) => e.sebep !== 'soyad' && !e.rakipVar)
          .map((e) => e.student_id),
      ),
    )
  }

  async function kaydet() {
    if (!eslesmeler || secili.size === 0 || kaydediliyor) return
    const yazilacak = eslesmeler.filter((e) => secili.has(e.student_id))

    if (
      !confirm(
        `${yazilacak.length} öğrencinin veli telefonu doldurulacak.\n` +
          'Hâlihazırda numarası olan kayıtlara dokunulmaz. Onaylıyor musunuz?',
      )
    )
      return

    setKaydediliyor(true)
    try {
      const sonuc = await telefonlariYaz(
        yazilacak.map((e) => ({ student_id: e.student_id, telefon: e.telefon })),
      )
      setMesaj({
        tip: 'ok',
        metin:
          `${sonuc.yazilan} öğrenciye telefon yazıldı` +
          (sonuc.atlanan ? ` — ${sonuc.atlanan} kayıt atlandı (numarası zaten vardı).` : '.'),
      })
      setEslesmeler(
        eslesmeler.filter((e) => !secili.has(e.student_id) || sonuc.yazilan === 0),
      )
      setSecili(new Set())
      router.refresh()
    } catch (e) {
      setMesaj({ tip: 'hata', metin: e instanceof Error ? e.message : 'Kaydedilemedi.' })
    } finally {
      setKaydediliyor(false)
    }
  }

  const guvenli = eslesmeler?.filter((e) => e.sebep !== 'soyad' && !e.rakipVar).length ?? 0

  return (
    <div className="space-y-4">
      <div className="kart space-y-3 p-4">
        <p className="text-sm text-solgun">
          {okulAdi} okulunda <strong className="text-metin">{toplam}</strong> aktif öğrenciden{' '}
          <strong className="text-metin">{eksikler.length}</strong> tanesinin veli telefonu
          boş. Telefonunun rehberini dışa aktarıp buraya verin, isimden eşleştirip
          dolduralım.
        </p>

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-vurgu">
            Rehberi nasıl dışa aktarırım?
          </summary>
          <div className="mt-2 space-y-1 text-solgun">
            <p>
              <strong>Android / Google:</strong> contacts.google.com → sol altta Dışa Aktar →
              “vCard” ya da “Google CSV” seçin, inen dosyayı buraya verin.
            </p>
            <p>
              <strong>iPhone:</strong> icloud.com/contacts → tümünü seçin → dişli simgesi →
              “vCard’ı Dışa Aktar”.
            </p>
            <p className="text-xs">
              Dosya sunucuya yüklenmez; tarayıcıda okunur, yalnızca onayladığınız
              öğrenci–numara eşleşmeleri kaydedilir.
            </p>
          </div>
        </details>

        <input
          type="file"
          accept=".vcf,.csv,text/vcard,text/csv"
          onChange={(e) => {
            const d = e.target.files?.[0]
            if (d) dosyaSecildi(d)
          }}
          className="block w-full cursor-pointer rounded-md border border-cizgi bg-white p-2
                     text-sm text-metin file:mr-3 file:rounded file:border-0 file:bg-slate-100
                     file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />

        {rehberSayisi !== null && (
          <p className="text-sm text-solgun">
            Rehberde <strong className="text-metin">{rehberSayisi}</strong> cep numarası
            okundu; <strong className="text-metin">{eslesmeler?.length ?? 0}</strong> öğrenciyle
            eşleşti ({guvenli} tanesi güvenli eşleşme).
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

      {eslesmeler && eslesmeler.length > 0 && (
        <>
          <div className="kart overflow-x-auto">
            <div className="flex flex-wrap items-center gap-3 border-b border-cizgi px-4 py-3">
              <h2 className="font-semibold">Eşleşmeler ({eslesmeler.length})</h2>
              <span className="text-xs text-solgun">
                Amber satırları mutlaka kontrol edin — yalnızca soyadı tuttuğu ya da birden
                fazla numara uyduğu için işaretsiz geldiler.
              </span>
              <button
                type="button"
                onClick={() =>
                  setSecili(
                    secili.size === eslesmeler.length
                      ? new Set()
                      : new Set(eslesmeler.map((e) => e.student_id)),
                  )
                }
                className="btn-ikincil ml-auto !py-1.5 text-sm"
              >
                {secili.size === eslesmeler.length ? 'Seçimi kaldır' : 'Tümünü seç'}
              </button>
            </div>

            <table className="tablo">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Öğrenci</th>
                  <th>Sistemdeki veli</th>
                  <th>Rehberdeki kişi</th>
                  <th>Telefon</th>
                  <th>Eşleşme</th>
                </tr>
              </thead>
              <tbody>
                {eslesmeler.map((e) => {
                  const supheli = e.sebep === 'soyad' || e.rakipVar
                  return (
                    <tr
                      key={e.student_id}
                      className={
                        secili.has(e.student_id)
                          ? 'bg-blue-50/60'
                          : supheli
                            ? 'bg-amber-50/50'
                            : undefined
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={secili.has(e.student_id)}
                          onChange={(ev) =>
                            setSecili((onceki) => {
                              const yeni = new Set(onceki)
                              if (ev.target.checked) yeni.add(e.student_id)
                              else yeni.delete(e.student_id)
                              return yeni
                            })
                          }
                          aria-label={`${e.ogrenci} eşleşmesini onayla`}
                        />
                      </td>
                      <td>
                        <span className="font-medium">{e.ogrenci}</span>
                        <span className="block text-xs text-solgun">{e.sinif ?? '—'}</span>
                      </td>
                      <td className="text-solgun">{e.veli ?? '—'}</td>
                      <td>{e.rehberAdi}</td>
                      <td className="font-mono text-xs">{e.telefon}</td>
                      <td>
                        <span className={`rozet ${SEBEP_ROZET[e.sebep].sinif}`}>
                          {SEBEP_ROZET[e.sebep].ad}
                        </span>
                        {e.rakipVar && (
                          <span className="rozet ml-1 bg-amber-100 text-amber-800">
                            birden fazla aday
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border border-cizgi bg-white/95 px-4 py-3 backdrop-blur">
            <span className="text-sm text-solgun">
              <strong className="text-metin tabular-nums">{secili.size}</strong> eşleşme
              onaylandı
            </span>
            <button
              type="button"
              onClick={kaydet}
              disabled={secili.size === 0 || kaydediliyor}
              className="btn-birincil ml-auto disabled:opacity-50"
            >
              {kaydediliyor ? 'Yazılıyor…' : 'Seçilenleri Kaydet'}
            </button>
          </div>
        </>
      )}

      {eslesmeler && eslesmeler.length === 0 && rehberSayisi !== null && rehberSayisi > 0 && (
        <p className="kart p-6 text-center text-solgun">
          Rehberdeki hiçbir kişi telefonu eksik öğrencilerle eşleşmedi.
        </p>
      )}
    </div>
  )
}
