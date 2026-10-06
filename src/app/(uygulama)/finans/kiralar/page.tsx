import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import { KiraEkrani, type KiraSatiri } from './KiraEkrani'
import { OKUL_KLASORU, SOZLESME_KOVASI, type SozlesmeDosyasi } from './sozlesme'

/** İmzalı bağlantı ömrü: bir saat, sekme açık kalsa da yetsin */
const BAGLANTI_SURESI = 60 * 60

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

  // Okulun sözleşme dosyaları: kovadaki klasörü listelenip her dosyaya
  // imzalı bağlantı üretiliyor. Kova herkese açık değil, bağlantı olmadan
  // dosya açılmıyor.
  const sozlesmeler: Record<string, SozlesmeDosyasi[]> = {}
  await Promise.all(
    Object.entries(OKUL_KLASORU).map(async ([okulAdi, klasor]) => {
      const { data: liste } = await supabase.storage
        .from(SOZLESME_KOVASI)
        .list(klasor, { sortBy: { column: 'name', order: 'asc' } })

      const dosyalar = (liste ?? []).filter((d) => d.id)
      if (dosyalar.length === 0) {
        sozlesmeler[okulAdi] = []
        return
      }

      const yollar = dosyalar.map((d) => `${klasor}/${d.name}`)
      const { data: baglantilar } = await supabase.storage
        .from(SOZLESME_KOVASI)
        .createSignedUrls(yollar, BAGLANTI_SURESI)

      sozlesmeler[okulAdi] = dosyalar.map((d, i) => ({
        ad: d.name,
        yol: yollar[i],
        boyut: (d.metadata?.size as number | undefined) ?? null,
        yuklenme: d.updated_at ?? d.created_at ?? null,
        baglanti: baglantilar?.[i]?.signedUrl ?? null,
      }))
    }),
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Kiralar</h1>
        <p className="text-sm text-solgun">
          Kira bedelini girin; arz, il payı, ilçe payı ve okula yatan kira kendiliğinden
          hesaplanır. Kalemleri tek tek de girebilirsiniz: tutar, ödeme tarihi ve belge
          numarası kutudan çıkınca kaydedilir. Ödendi işaretli satırlara hesaplama
          dokunmaz. Her okulun kira sözleşmelerini de buraya yükleyip buradan
          açabilirsiniz.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <KiraEkrani
        satirlar={satirlar}
        tabanlar={tabanKaydi}
        sozlesmeler={sozlesmeler}
        bugun={bugun}
      />
    </div>
  )
}
