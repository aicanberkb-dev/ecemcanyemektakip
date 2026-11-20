import { supabaseServer } from '@/lib/supabase/server'

import { CiroEkrani, type CiroSatiri, type EkGelir, type GunlukTahsilat } from './CiroEkrani'

export const metadata = { title: 'Günlük Ciro — Yemek Takip' }

/** Hiç kayıt yokken ekranda duran yerler */
const VARSAYILAN_YERLER = ['GÖKSU', 'AKBABA', 'TORİK']

/**
 * Öğrenci ve kurum tahsilatlarının ciroda gösterilmeye başladığı gün.
 *
 * Öncesi için bu kalemler takip edilmiyordu; eski günlerde yarım rakam
 * göstermektense hiç göstermemek doğru.
 */
const BASLANGIC = '2026-10-22'

export default async function CiroPage() {
  const supabase = await supabaseServer()
  const [{ data, error }, { data: ekVeri }, { data: ogrenciVeri }, { data: kurumVeri }] =
    await Promise.all([
      supabase
        .from('gunluk_ciro')
        .select(
          'id, tarih, yer, tutar, nakit, kart, kart_yatan, aciklama, kart_kirilimi, kart_yatan_kirilimi',
        )
        .order('tarih', { ascending: false }),
      supabase
        .from('ciro_ek_gelir')
        .select('id, tarih, kaynak, tutar, aciklama')
        .order('tarih', { ascending: false }),
      // Öğrenci parası: yalnız havale, yalnız GÖKSU. Nakit ve kartla ödenenler
      // zaten kasaya ve posa giriyor, buraya alınsa iki kez sayılırdı.
      supabase.rpc('ciro_ogrenci_havaleleri', { bas: BASLANGIC }),
      // Kurum ödemeleri: Alacaklar sayfasında girilen fatura tahsilatları
      supabase.rpc('ciro_kurum_tahsilatlari', { bas: BASLANGIC }),
    ])

  const satirlar = (data ?? []) as CiroSatiri[]
  const yerler = [...new Set([...VARSAYILAN_YERLER, ...satirlar.map((s) => s.yer)])]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Günlük Ciro</h1>
        <p className="text-sm text-solgun">
          Yerlerin gün gün hasılatı. Bir günü girip kaydet; aynı günü tekrar girersen
          eskisinin üstüne yazar, toplam şişmez. Yeni bir yer eklemek için kutuya adını
          yaz, listeye kendiliğinden girer. Tarihi değiştirince o güne girilmiş
          rakamlar forma gelir; kredi kartını banka banka kırmak istersen kartın
          altındaki bağlantıyı kullan. <strong>Öğrenci parası</strong> (GÖKSU
          havaleleri) ve <strong>kurum ödemeleri</strong> kendiliğinden gelir,
          elle girilmez: ilki Tahsilat ekranından, ikincisi Alacaklar
          sayfasından okunur.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <CiroEkrani
        satirlar={satirlar}
        yerler={yerler}
        ekGelirler={(ekVeri ?? []) as EkGelir[]}
        ogrenciHavaleleri={(ogrenciVeri ?? []) as GunlukTahsilat[]}
        kurumTahsilatlari={(kurumVeri ?? []) as GunlukTahsilat[]}
      />
    </div>
  )
}
