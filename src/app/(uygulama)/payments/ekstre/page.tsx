import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

import { AktarimGecmisi, type AktarimKaydi } from './AktarimGecmisi'
import { EkstreEkrani, type OgrenciSecenegi } from './EkstreEkrani'

export const metadata = { title: 'Ekstre Aktarımı — Yemek Takip' }

export default async function EkstrePage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  // kalan: bölüştürme yaparken hangi kardeşin ne kadar borcu olduğu görünsün
  const { data } = await supabase
    .from('student_balances')
    .select('student_id, ogrenci_no, ad_soyad, sinif, kardes_grup_id, kalan')
    .eq('okul_id', okul.id)
    .eq('aktif', true)
    .order('ogrenci_no')

  const ogrenciler: OgrenciSecenegi[] = (
    (data ?? []) as {
      student_id: string
      ogrenci_no: string
      ad_soyad: string
      sinif: string | null
      kardes_grup_id: string | null
      kalan: number | string
    }[]
  ).map((o) => ({
    id: o.student_id,
    ogrenci_no: o.ogrenci_no,
    ad_soyad: o.ad_soyad,
    sinif: o.sinif,
    kardes_grup_id: o.kardes_grup_id,
    kalan: Number(o.kalan),
  }))

  const gecmis = await aktarimGecmisi(okul.id)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">Ekstre Aktarımı</h1>
          <p className="text-sm text-solgun">
            Bankadan indirdiğiniz hesap hareketlerini yükleyin; gelen ödemeler veli adına
            göre öğrencilerle eşleştirilir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
          <Link href="/payments/new" className="text-sm text-vurgu hover:underline">
            Tek tahsilat gir →
          </Link>
        </div>
      </div>

      {ogrenciler.length === 0 ? (
        <p className="kart p-6 text-center text-solgun">
          Bu okulda kayıtlı öğrenci yok. Önce{' '}
          <Link href="/students/new" className="text-vurgu hover:underline">
            öğrenci ekleyin
          </Link>
          .
        </p>
      ) : (
        // key: okul değişince yüklenen dosya ve seçimler sıfırlanır
        <EkstreEkrani key={okul.id} ogrenciler={ogrenciler} />
      )}

      <AktarimGecmisi kayitlar={gecmis} />
    </div>
  )
}

/**
 * Son aktarımlar ve her birinin yazdığı tahsilatlar.
 *
 * Kayıtlar tek sorguda çekilip aktarıma göre gruplanıyor; her satır için ayrı
 * sorgu atmak listeyi yavaşlatırdı.
 */
async function aktarimGecmisi(okulId: string): Promise<AktarimKaydi[]> {
  const supabase = await supabaseServer()

  const { data: aktarimVeri } = await supabase
    .from('ekstre_aktarimlari')
    .select('*')
    .eq('okul_id', okulId)
    .order('created_at', { ascending: false })
    .limit(20)

  const aktarimlar = (aktarimVeri ?? []) as {
    id: string
    dosya_adi: string
    aktaran_user_id: string
    satir_sayisi: number
    eklenen: number
    atlanan: number
    mukerrer_atlanan: number
    toplam_tutar: number | string
    ekstre_bas: string | null
    ekstre_bit: string | null
    created_at: string
  }[]

  if (aktarimlar.length === 0) return []

  const idler = aktarimlar.map((a) => a.id)
  const [{ data: islemVeri }, { data: profilVeri }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, tarih, tutar, ekstre_aktarim_id, students(ad_soyad)')
      .in('ekstre_aktarim_id', idler)
      .order('tarih'),
    supabase
      .from('profiles')
      .select('id, ad_soyad')
      .in('id', [...new Set(aktarimlar.map((a) => a.aktaran_user_id))]),
  ])

  const adlar = new Map(
    ((profilVeri ?? []) as { id: string; ad_soyad: string | null }[]).map((p) => [
      p.id,
      p.ad_soyad ?? '—',
    ]),
  )

  // Supabase gömülü ilişkiyi dizi olarak tipliyor; tekil kayıt da dizi gelir.
  const islemler = (islemVeri ?? []) as unknown as {
    id: string
    tarih: string
    tutar: number | string
    ekstre_aktarim_id: string
    students: { ad_soyad: string }[] | { ad_soyad: string } | null
  }[]

  const ogrenciAdi = (s: (typeof islemler)[number]['students']): string =>
    (Array.isArray(s) ? s[0]?.ad_soyad : s?.ad_soyad) ?? '—'

  return aktarimlar.map((a) => ({
    id: a.id,
    dosyaAdi: a.dosya_adi,
    aktaran: adlar.get(a.aktaran_user_id) ?? '—',
    aktarmaZamani: a.created_at,
    ekstreBas: a.ekstre_bas,
    ekstreBit: a.ekstre_bit,
    satirSayisi: a.satir_sayisi,
    eklenen: a.eklenen,
    atlanan: a.atlanan,
    mukerrerAtlanan: a.mukerrer_atlanan,
    toplamTutar: Number(a.toplam_tutar),
    kayitlar: islemler
      .filter((t) => t.ekstre_aktarim_id === a.id)
      .map((t) => ({
        id: t.id,
        ogrenci: ogrenciAdi(t.students),
        tarih: t.tarih,
        tutar: Number(t.tutar),
      })),
  }))
}
