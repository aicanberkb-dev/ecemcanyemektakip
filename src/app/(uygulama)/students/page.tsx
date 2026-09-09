import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { bekleyenler, rehberListesi } from '@/lib/rehber-sunucu'
import { taksitHaritasi } from '@/lib/taksit-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance } from '@/lib/types'

import { OgrenciListesi, type OgrenciSatiri } from './OgrenciListesi'

export const metadata = { title: 'Öğrenciler — Yemek Takip' }

export default async function StudentsPage() {
  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  // Aylıkçının ölçüsü bakiye değil taksit planı; durum ortak yardımcıdan gelir.
  const taksitler = await taksitHaritasi(okul.id)

  const [{ data, error }, { data: sinifSatirlari }] = await Promise.all([
    supabase.from('student_balances').select('*').eq('okul_id', okul.id).order('ad_soyad'),
    supabase.from('students').select('sinif').eq('okul_id', okul.id).not('sinif', 'is', null),
  ])

  const ogrenciler: OgrenciSatiri[] = ((data ?? []) as StudentBalance[]).map((o) => ({
    student_id: o.student_id,
    ogrenci_no: o.ogrenci_no,
    ad_soyad: o.ad_soyad,
    sinif: o.sinif,
    veli_tc: o.veli_tc,
    veli_adi: o.veli_adi,
    veli_telefon: o.veli_telefon,
    veli2_adi: o.veli2_adi,
    veli2_telefon: o.veli2_telefon,
    iskonto_orani: Number(o.iskonto_orani),
    iskonto_tutar: Number(o.iskonto_tutar),
    devir: Number(o.devir),
    ogun_sayisi: Number(o.ogun_sayisi),
    kardes_grup_id: o.kardes_grup_id,
    abone_tipi: o.abone_tipi,
    ogrenci_tipi: o.ogrenci_tipi,
    aktif: o.aktif,
    alinan_para: Number(o.alinan_para),
    harcanan: Number(o.harcanan),
    kalan: Number(o.kalan),
    taksit: taksitler.get(o.student_id) ?? null,
  }))

  // Rehberde kaç veli bekliyor? Daha önce aktarılanlar tekrar verilmiyor.
  const rehberKisiler = await rehberListesi(false, okul.id)
  const { yeni, degisen } = await bekleyenler(rehberKisiler)
  const bekleyenSayisi = yeni.length + degisen.length
  const rehberToplam = rehberKisiler.length

  const siniflar = [
    ...new Set((sinifSatirlari ?? []).map((s) => s.sinif as string).filter(Boolean)),
  ].sort()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="baslik">Öğrenciler</h1>
        <div className="flex flex-wrap gap-2">
          {/* Telefon rehberine toplu kişi eklemek için: WhatsApp numaraları
              rehberden okuyor, kendi içine kaydedilemiyor.
              Link değil <a>: bu bir sayfa değil, dosya indiren bir uç nokta;
              istemci tarafı gezinme indirmeyi başlatmaz. */}
          <RehberDugmesi bekleyen={bekleyenSayisi} toplam={rehberToplam} />
          <Link href="/students/kayit-formu" className="btn-ikincil">
            Kayıt Formu Yazdır
          </Link>
          <Link href="/students/new" className="btn-birincil">
            + Yeni Öğrenci
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <OgrenciListesi
        ogrenciler={ogrenciler}
        siniflar={siniflar}
        sezonVarMi={taksitler.size > 0}
      />
    </div>
  )
}

/**
 * Rehber indirme.
 *
 * Varsayılan indirme yalnızca daha önce verilmemiş numaraları içerir; aynı
 * numarayı ikinci kez vermek telefonda mükerrer kart oluşturuyor. Tamamı
 * gerekirse ikinci bağlantı duruyor — telefon değiştirmek ya da rehberi
 * sıfırdan kurmak gibi durumlar için.
 */
function RehberDugmesi({ bekleyen, toplam }: { bekleyen: number; toplam: number }) {
  return (
    <span className="inline-flex flex-col items-start">
      {bekleyen > 0 ? (
        <a
          href="/students/rehber"
          download
          className="btn-ikincil"
          title="Daha önce aktarılmamış veli numaralarını vCard olarak indirir"
        >
          Veli Rehberi İndir ({bekleyen} yeni)
        </a>
      ) : (
        <span className="btn-ikincil cursor-default opacity-60" title="Yeni veli yok">
          Rehber güncel
        </span>
      )}
      <a
        href="/students/rehber?kapsam=tumu"
        download
        className="mt-1 text-xs text-solgun hover:underline"
        title="Daha önce aktarılanlar dahil bütün velileri indirir"
      >
        tümünü indir ({toplam})
      </a>
    </span>
  )
}
