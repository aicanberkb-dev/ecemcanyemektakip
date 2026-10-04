import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import { KiraEkrani, type KiraSatiri } from './KiraEkrani'

export const metadata = { title: 'Kiralar — Yemek Takip' }

/**
 * Kiralar: işletilen birimlerin kira ve pay ödemeleri.
 *
 * Satırlar önceden açılmıyor; ekran taksit listesini kendi üretiyor ve bir
 * değer girilince kayıt oluşuyor. Bu yüzden burada yalnızca var olan
 * kayıtlar okunuyor, eksikleri ekran tamamlıyor.
 */
export default async function KiralarPage() {
  const supabase = await supabaseServer()
  const bugun = await bugunSunucu()
  const [{ data, error }, { data: tabanlar }] = await Promise.all([
    supabase
      .from('kiralar')
      .select('id, birim, kalem, sira, tutar, odeme_tarihi, belge_no, odendi'),
    supabase.from('kira_tabanlari').select('anahtar, sira, tutar').order('sira'),
  ])

  const satirlar = (data ?? []) as KiraSatiri[]

  // Taban kira kademeleri: "şu taksitten itibaren kira şu". Ekran kalemleri
  // bunlardan hesaplıyor; yıl ortasındaki zam yeni bir kademe oluyor.
  const tabanKaydi: Record<string, { sira: number; tutar: number }[]> = {}
  for (const t of (tabanlar ?? []) as {
    anahtar: string
    sira: number
    tutar: number | string
  }[]) {
    ;(tabanKaydi[t.anahtar] ??= []).push({ sira: t.sira, tutar: Number(t.tutar) })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Kiralar</h1>
        <p className="text-sm text-solgun">
          Kira bedelini girin; arz, il payı, ilçe payı ve okula yatan kira kendiliğinden
          hesaplanır. Kalemleri tek tek de girebilirsiniz: tutar, ödeme tarihi ve belge
          numarası kutudan çıkınca kaydedilir. Ödendi işaretli satırlara hesaplama
          dokunmaz.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <KiraEkrani satirlar={satirlar} tabanlar={tabanKaydi} bugun={bugun} />
    </div>
  )
}
