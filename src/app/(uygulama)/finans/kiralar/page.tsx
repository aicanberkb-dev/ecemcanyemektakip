import Link from 'next/link'

import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import { dekontKodu, DEKONT_KOVASI, type Dekont } from './dekont'
import { FaturaEkrani, type Abonelik, type FaturaSatiri } from './FaturaEkrani'
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
export default async function KiralarPage({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>
}) {
  const { sekme } = await searchParams
  const faturaSekmesi = sekme === 'faturalar'
  const supabase = await supabaseServer()
  const bugun = await bugunSunucu()
  const [{ data, error }, { data: tabanlar }] = await Promise.all([
    supabase
      .from('kiralar')
      .select('id, birim, kalem, sira, tutar, odeme_tarihi, belge_no, odendi'),
    supabase.from('kira_tabanlari').select('anahtar, sira, tutar').order('sira'),
  ])

  // Dekontlar ve kapsadiklari taksitler. Bir dekont birden fazla satira
  // baglanabiliyor; rozet kodu yukleme sirasina gore veriliyor.
  const { data: dekontKayitlari } = await supabase
    .from('kira_dekontlari')
    .select('id, birim, dosya_adi, dosya_yolu, odeme_tarihi, tutar, aciklama, created_at, kira_dekont_satirlari(kira_id)')
    .order('created_at')

  // Her dekonta imzali baglanti: kova herkese acik degil.
  const dekontYollari = (dekontKayitlari ?? []).map(
    (d) => (d as { dosya_yolu: string }).dosya_yolu,
  )
  const { data: dekontBaglantilari } =
    dekontYollari.length > 0
      ? await supabase.storage.from(DEKONT_KOVASI).createSignedUrls(dekontYollari, BAGLANTI_SURESI)
      : { data: null }

  // Rozet kodu birim icinde sayiliyor: her okulun dekontlari DK-01'den
  // basliyor, numara ekranda okunur kalsin.
  const birimSayaci: Record<string, number> = {}
  const dekontlar: Dekont[] = (dekontKayitlari ?? []).map((ham, i) => {
    const d = ham as {
      id: string
      birim: string
      dosya_adi: string
      dosya_yolu: string
      odeme_tarihi: string | null
      tutar: number | string | null
      aciklama: string | null
      kira_dekont_satirlari: { kira_id: string }[] | null
    }
    birimSayaci[d.birim] = (birimSayaci[d.birim] ?? 0) + 1
    return {
      id: d.id,
      birim: d.birim,
      kod: dekontKodu(birimSayaci[d.birim]),
      dosya_adi: d.dosya_adi,
      dosya_yolu: d.dosya_yolu,
      odeme_tarihi: d.odeme_tarihi,
      tutar: d.tutar === null ? null : Number(d.tutar),
      aciklama: d.aciklama,
      kiraIdleri: (d.kira_dekont_satirlari ?? []).map((b) => b.kira_id),
      baglanti: dekontBaglantilari?.[i]?.signedUrl ?? null,
    }
  })

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

  // Faturalar sekmesi: elektrik, su ve doğalgaz. Abonelik bilgisi bir kez
  // giriliyor, tutar her ay değiştiği için dönem dönem yazılıyor.
  const [{ data: abonelikVeri }, { data: faturaVeri }] = await Promise.all([
    supabase.from('fatura_abonelikleri').select('yer, gider_turu, sozlesme_no, vade_gunu'),
    supabase
      .from('fatura_odemeleri')
      .select('yer, gider_turu, donem, tutar, odeme_tarihi, odendi'),
  ])

  const SEKMELER = [
    { anahtar: 'kiralar', ad: 'Kiralar' },
    { anahtar: 'faturalar', ad: 'Faturalar' },
  ]

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Bölüm">
        {SEKMELER.map((s) => {
          const seciliMi = (s.anahtar === 'faturalar') === faturaSekmesi
          return (
            <Link
              key={s.anahtar}
              href={s.anahtar === 'kiralar' ? '/finans/kiralar' : '/finans/kiralar?sekme=faturalar'}
              aria-current={seciliMi ? 'page' : undefined}
              className={`rounded-md border px-4 py-2 text-sm font-semibold ${
                seciliMi
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-cizgi bg-white hover:bg-slate-50'
              }`}
            >
              {s.ad}
            </Link>
          )
        })}
      </nav>

      {faturaSekmesi ? (
        <>
          <div>
            <h1 className="baslik">Faturalar</h1>
            <p className="text-sm text-solgun">
              Elektrik, su ve doğalgaz. Sözleşme numarasını ve vade gününü bir kez
              girin; tutar her ay değiştiği için dönem dönem yazılır. Ödendi
              işaretlediğiniz fatura günlük masraflara da düşer.
            </p>
          </div>

          <FaturaEkrani
            abonelikler={(abonelikVeri ?? []) as Abonelik[]}
            faturalar={(faturaVeri ?? []) as FaturaSatiri[]}
            bugun={bugun}
          />
        </>
      ) : (
      <>
      <div>
        <h1 className="baslik">Kiralar</h1>
        <p className="text-sm text-solgun">
          Kira bedelini girin; arz, il payı, ilçe payı ve okula yatan kira kendiliğinden
          hesaplanır. Kalemleri tek tek de girebilirsiniz: tutar, ödeme tarihi ve belge
          numarası kutudan çıkınca kaydedilir. Ödendi işaretli satırlara hesaplama
          dokunmaz. Her okulun kira sözleşmelerini de buraya yükleyip buradan
          açabilirsiniz. Ödeme dekontlarını da yükleyebilirsiniz: bir dekont
          birden fazla taksiti kapsıyorsa yüklerken hangilerini kapsadığını
          işaretlersiniz, o taksitlerin hepsinde aynı rozet görünür.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <KiraEkrani
        satirlar={satirlar}
        tabanlar={tabanKaydi}
        sozlesmeler={sozlesmeler}
        dekontlar={dekontlar}
        bugun={bugun}
      />
      </>
      )}
    </div>
  )
}
