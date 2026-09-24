import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

import { RehberAktar } from './RehberAktar'

export const metadata = { title: 'Rehberden Telefon Aktar — Yemek Takip' }

/**
 * Telefon rehberindeki numaraları sisteme aktarma.
 *
 * Veli numaraları çoğu zaman telefonun rehberinde var ama sistemde yok;
 * 85 kaydı elle girmek uzun iş. Rehber dosyası (vCard / CSV) tarayıcıda
 * okunup isimle eşleştiriliyor, eşleşmeleri kullanıcı onaylıyor.
 *
 * Dosya sunucuya yüklenmiyor: bütün rehber tarayıcıda çözülüyor, yalnızca
 * onaylanan öğrenci-numara çiftleri kaydediliyor.
 */
export default async function RehberAktarPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()

  // Yalnızca telefonu boş olan aktif öğrenciler: dolu kayda dokunulmuyor
  const { data, error } = await supabase
    .from('students')
    .select('id, ad_soyad, sinif, veli_adi, veli2_adi, veli_telefon, veli2_telefon')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .order('ad_soyad')

  const hepsi = (data ?? []) as {
    id: string
    ad_soyad: string
    sinif: string | null
    veli_adi: string | null
    veli2_adi: string | null
    veli_telefon: string | null
    veli2_telefon: string | null
  }[]

  const eksikler = hepsi
    .filter((o) => !o.veli_telefon?.trim() && !o.veli2_telefon?.trim())
    .map((o) => ({
      student_id: o.id,
      ad_soyad: o.ad_soyad,
      veli_adi: o.veli_adi ?? o.veli2_adi,
      sinif: o.sinif,
    }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Rehberden Telefon Aktar</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <RehberAktar okulAdi={okul.ad} eksikler={eksikler} toplam={hepsi.length} />
    </div>
  )
}
