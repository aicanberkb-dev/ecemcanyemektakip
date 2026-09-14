import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { okulKapaliGunleri } from '@/lib/okulsuz'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { YoklamaKagidi, YoklamaSayfaAyari } from './YoklamaKagidi'

export const metadata = { title: '1. Sınıf Yoklama Çizelgesi — Yemek Takip' }

/**
 * 1. sınıfların aylık yoklama çizelgesi — boş, elle doldurulmak üzere.
 *
 * Bu öğrenciler sınıflarından toplu alındığı için yemekhanede tek tek
 * okutulmuyor; personel kâğıda çarpı atıyor, kayıtlar sonradan Toplu Giriş
 * ekranından sisteme işleniyor. Çizelge şube başına ayrı sayfa basılır:
 * her kâğıt tek bir sınıfa gider.
 */
export default async function YoklamaPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  const okul = await aktifOkul()
  if (!okul) return null

  const iki = (n: number) => String(n).padStart(2, '0')
  const supabase = await supabaseServer()

  // Tatil günleri yoklama kâğıdında da kapalı görünsün; öğretmen o güne
  // yanlışlıkla işaret koymasın.
  // Genel tatil ya da bu okula özel kapalı gün
  const tatilVeri = await okulKapaliGunleri(
    supabase,
    okul.id,
    `${yil}-${iki(ay)}-01`,
    `${yil}-${iki(ay)}-${new Date(yil, ay, 0).getDate()}`,
  )

  const tatilGunleri = new Set(tatilVeri.map((t) => Number(t.tarih.slice(8, 10))))

  const { data } = await supabase
    .from('student_balances')
    .select('student_id, ogrenci_no, ad_soyad, sinif')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .like('sinif', '1-%')
    .order('ad_soyad')

  const ogrenciler = (data ?? []) as Pick<
    StudentBalance,
    'student_id' | 'ogrenci_no' | 'ad_soyad' | 'sinif'
  >[]

  // Şube bazlı gruplama: her kâğıt tek bir sınıfa gidiyor
  const subeler = new Map<string, typeof ogrenciler>()
  for (const o of ogrenciler) {
    const anahtar = o.sinif?.trim() || 'Sınıfı girilmemiş'
    const liste = subeler.get(anahtar) ?? []
    liste.push(o)
    subeler.set(anahtar, liste)
  }
  const sirali = [...subeler.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))

  return (
    <div className="space-y-4">
      <div className="yazdirma-gizle space-y-3">
        <Link href="/reports" className="text-sm text-vurgu hover:underline">
          ← Raporlar
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="baslik">1. Sınıf Yoklama Çizelgesi</h1>
            <p className="text-sm text-solgun">
              Boş çizelge. Personel yemeğe gelen öğrencinin gününe çarpı atar; kayıtlar
              sonradan{' '}
              <Link href="/toplu" className="text-vurgu hover:underline">
                Toplu Giriş
              </Link>{' '}
              ekranından sisteme işlenir.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
            <YazdirButonu etiket={`Yazdır (${sirali.length} sayfa)`} />
          </div>
        </div>

        <form className="kart flex flex-wrap items-end gap-3 p-4">
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

        {ogrenciler.length === 0 && (
          <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bu okulda <strong>1. Sınıf</strong> tipinde aktif öğrenci yok. Öğrenci
            kaydında <strong>Öğrenci Tipi</strong> alanını “1. Sınıf” seçtiğinizde burada
            listelenirler.
          </p>
        )}
      </div>

      {/* Yatay A4, her şube tek sayfa; ekranda da basıldığı boyutta görünür */}
      <YoklamaSayfaAyari />
      <div className="space-y-6 overflow-x-auto print:space-y-0 print:overflow-visible">
        {sirali.map(([sube, liste], i) => (
          <YoklamaKagidi
            key={sube}
            sube={sube}
            okulAdi={okul.ad}
            yil={yil}
            ay={ay}
            ogrenciler={liste}
            kapaliGunler={[...tatilGunleri]}
            sonMu={i === sirali.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
