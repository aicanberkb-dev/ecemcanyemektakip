import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import { KiraEkrani, type KiraSatiri } from './KiraEkrani'

export const metadata = { title: 'Kiralar — Yemek Takip' }

/**
 * Kiralar: işletilen birimlerin kira ve pay ödemeleri.
 *
 * Satırlar önceden açılmıyor; ekran dönem listesini kendi üretiyor ve bir
 * değer girilince kayıt oluşuyor. Bu yüzden burada yalnızca var olan
 * kayıtlar okunuyor, eksikleri ekran tamamlıyor.
 */
export default async function KiralarPage() {
  const supabase = await supabaseServer()
  const bugun = await bugunSunucu()
  const { data, error } = await supabase
    .from('kiralar')
    .select('id, birim, kalem, donem, sira, tutar, odeme_tarihi, belge_no, odendi')

  const satirlar = (data ?? []) as KiraSatiri[]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Kiralar</h1>
        <p className="text-sm text-solgun">
          Her birimin kira, il payı ve ilçe payı ödemeleri ay ay; üç aylık kalem ise
          1., 2. ve 3. taksit olarak. Tutarı, ödeme tarihini ve belge numarasını girip
          ödendi olarak işaretleyin. Girilen değer kutudan çıkınca kendiliğinden kaydedilir.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <KiraEkrani satirlar={satirlar} bugun={bugun} />
    </div>
  )
}
