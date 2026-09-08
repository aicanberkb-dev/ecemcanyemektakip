'use server'

import { revalidatePath } from 'next/cache'

import { adaylariBul, ekstreOku, type EslesmeAdayi, type VeliKaydi } from '@/lib/ekstre'
import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import {
  mukerrerAnahtarlar,
  tahsilatAnahtari,
  type MevcutTahsilat,
} from '@/lib/tahsilat-mukerrer'

export type OneriSatiri = {
  tarih: string
  fisNo: string
  aciklama: string
  tutar: number
  gonderen: string
  adaylar: EslesmeAdayi[]
  /** Bu fiş daha önce aktarılmışsa true — tekrar işlenmemeli */
  zatenVar: boolean
}

export type CozumlemeDurumu = {
  hata?: string
  dosyaAdi?: string
  satirlar?: OneriSatiri[]
  /**
   * Ekstrenin kapsadığı tarihlerdeki mevcut tahsilatlar.
   *
   * Fiş numarası kontrolü yalnızca "aynı ekstre iki kez yüklendi" durumunu
   * yakalıyor. Asıl tuzak başka: ödeme önce elle giriliyor (fiş numarası yok),
   * sonra aynı ödeme ekstreden aktarılıyor ve öğrenciye iki kez işleniyor.
   * Bu liste, öğrenci seçilir seçilmez ekranda uyarı çıkarmak için gönderiliyor.
   */
  mevcutTahsilatlar?: MevcutTahsilat[]
}

/**
 * Yüklenen ekstre dosyasını çözümler ve her para girişi için öğrenci adayları
 * önerir. Hiçbir şey kaydetmez — kaydetme ayrı bir adım.
 */
export async function ekstreCozumle(
  _onceki: CozumlemeDurumu,
  formData: FormData,
): Promise<CozumlemeDurumu> {
  const dosya = formData.get('dosya')
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { hata: 'Ekstre dosyası seçin.' }
  }

  let satirlar
  try {
    satirlar = ekstreOku(new Uint8Array(await dosya.arrayBuffer()))
  } catch {
    return { hata: 'Dosya okunamadı. Bankadan indirdiğiniz Excel dosyasını olduğu gibi yükleyin.' }
  }

  if (satirlar.length === 0) {
    return { hata: 'Dosyada para girişi bulunamadı.', dosyaAdi: dosya.name }
  }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const { data: ogrenciler, error } = await supabase
    .from('students')
    .select('id, ogrenci_no, ad_soyad, sinif, veli_adi, veli2_adi')
    .eq('okul_id', okulId)
    .eq('aktif', true)

  if (error) return { hata: error.message }

  const veliler: VeliKaydi[] = (ogrenciler ?? []).map((o) => ({
    studentId: o.id,
    ogrenciNo: o.ogrenci_no,
    adSoyad: o.ad_soyad,
    sinif: o.sinif,
    veliAdi: o.veli_adi,
    veli2Adi: o.veli2_adi,
  }))

  // Daha önce aktarılmış fişleri işaretle: aynı dosya iki kez yüklenirse
  // kullanıcı bunu tabloda görsün, sessizce mükerrer kayıt oluşmasın.
  const fisNolar = satirlar.map((s) => s.fisNo).filter(Boolean)
  const { data: mevcut } = await supabase
    .from('transactions')
    .select('banka_fis_no, tarih, tutar')
    .in('banka_fis_no', fisNolar.length > 0 ? fisNolar : ['-'])

  const mevcutAnahtar = new Set(
    (mevcut ?? []).map((m) => `${m.banka_fis_no}|${m.tarih}|${Number(m.tutar)}`),
  )

  // Ekstrenin kapsadığı günlerdeki tahsilatlar: öğrenci seçilince ekran
  // "bu ödeme zaten girilmiş" diyebilsin. Elle girilenler de buraya dahil,
  // çünkü asıl mükerrerlik oradan geliyor.
  const tarihler = satirlar.map((s) => s.tarih).sort()
  const { data: gunlukTahsilat } = await supabase
    .from('transactions')
    .select('student_id, tarih, tutar')
    .eq('tip', 'tahsilat')
    .gte('tarih', tarihler[0])
    .lte('tarih', tarihler[tarihler.length - 1])
    .in(
      'student_id',
      veliler.length > 0 ? veliler.map((v) => v.studentId) : ['00000000-0000-0000-0000-000000000000'],
    )

  const mevcutTahsilatlar: MevcutTahsilat[] = (
    (gunlukTahsilat ?? []) as { student_id: string; tarih: string; tutar: number | string }[]
  ).map((t) => ({ studentId: t.student_id, tarih: t.tarih, tutar: Number(t.tutar) }))

  return {
    dosyaAdi: dosya.name,
    mevcutTahsilatlar,
    satirlar: satirlar.map((s) => ({
      ...s,
      adaylar: adaylariBul(s.gonderen, veliler),
      zatenVar: mevcutAnahtar.has(`${s.fisNo}|${s.tarih}|${s.tutar}`),
    })),
  }
}

export type KayitGirdisi = {
  studentId: string
  tarih: string
  tutar: number
  fisNo: string
  aciklama: string
  /** Kullanıcı mükerrer uyarısını görüp "yine de aktar" dediyse true */
  onay?: boolean
}

export type KayitDurumu = {
  hata?: string
  basari?: string
  eklenen?: number
  atlanan?: number
  /** Aynı öğrenci/gün/tutar zaten kayıtlı olduğu için aktarılmayanlar */
  mukerrerAtlanan?: number
}

/**
 * Onaylanan satırları tahsilat olarak yazar.
 *
 * Ödeme yöntemi havale olarak sabittir — bu ekran yalnızca banka ekstresinden
 * beslenir. Mükerrer kayıt veritabanındaki benzersiz kısıtla engellenir; kısıta
 * takılan satır hata sayılmaz, atlanır.
 */
export async function tahsilatlariKaydet(girdiler: KayitGirdisi[]): Promise<KayitDurumu> {
  if (girdiler.length === 0) return { hata: 'Aktarılacak satır seçilmedi.' }

  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  // Seçilen öğrencilerin aktif okula ait olduğunu sunucuda doğrula:
  // istemciden gelen id'ye güvenilmez.
  const idler = [...new Set(girdiler.map((g) => g.studentId))]
  const { data: gecerli, error: ogrenciHata } = await supabase
    .from('students')
    .select('id')
    .eq('okul_id', okulId)
    .in('id', idler)

  if (ogrenciHata) return { hata: ogrenciHata.message }
  const gecerliIdler = new Set((gecerli ?? []).map((o) => o.id))
  if (gecerliIdler.size !== idler.length) {
    return { hata: 'Seçilen öğrencilerden bazıları bu okula ait değil.' }
  }

  // Mükerrer kontrolü sunucuda da yapılır: ekran uyarı gösteriyor ama tek
  // güvence o değil. Aradan geçen sürede başka biri aynı ödemeyi girmiş
  // olabilir; ayrıca aynı aktarımda iki özdeş satır bulunabilir.
  const tarihler = girdiler.map((g) => g.tarih).sort()
  const { data: mevcutVeri } = await supabase
    .from('transactions')
    .select('student_id, tarih, tutar')
    .eq('tip', 'tahsilat')
    .gte('tarih', tarihler[0])
    .lte('tarih', tarihler[tarihler.length - 1])
    .in('student_id', idler)

  const varOlan = mukerrerAnahtarlar(
    ((mevcutVeri ?? []) as { student_id: string; tarih: string; tutar: number | string }[]).map(
      (t) => ({ studentId: t.student_id, tarih: t.tarih, tutar: Number(t.tutar) }),
    ),
  )

  let eklenen = 0
  let atlanan = 0
  let mukerrerAtlanan = 0

  for (const g of girdiler) {
    const anahtar = tahsilatAnahtari(g.studentId, g.tarih, g.tutar)
    if (varOlan.has(anahtar) && !g.onay) {
      mukerrerAtlanan++
      continue
    }

    const { error } = await supabase.from('transactions').insert({
      student_id: g.studentId,
      tarih: g.tarih,
      tip: 'tahsilat',
      tutar: g.tutar,
      aciklama: g.aciklama,
      odeme_yontemi: 'havale',
      banka_fis_no: g.fisNo || null,
    })

    if (error) {
      if (error.message.includes('transactions_banka_fis_uniq')) {
        atlanan++
        continue
      }
      return { hata: error.message, eklenen, atlanan, mukerrerAtlanan }
    }
    eklenen++
    // Aynı aktarımdaki ikinci özdeş satır da yakalansın.
    varOlan.add(anahtar)
  }

  revalidatePath('/students')
  revalidatePath('/reports')
  revalidatePath('/dashboard')

  const parcalar = [`${eklenen} tahsilat aktarıldı.`]
  if (atlanan > 0) parcalar.push(`${atlanan} satır daha önce aktarıldığı için atlandı.`)
  if (mukerrerAtlanan > 0) {
    parcalar.push(
      `${mukerrerAtlanan} satır, aynı öğrenciye aynı gün aynı tutar zaten girildiği için atlandı.`,
    )
  }
  return { basari: parcalar.join(' '), eklenen, atlanan, mukerrerAtlanan }
}
