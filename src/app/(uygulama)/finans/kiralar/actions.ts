'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { kademeAraliklari, kiraKirilimi, TAKSIT_SAYISI } from '@/lib/kira-hesap'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

import { DEKONT_KOVASI } from './dekont'
import { KALEM_ADLARI, type Kalem } from './kalemler'

export type KiraDurumu = { hata?: string; basari?: string }

type Baglanti = Awaited<ReturnType<typeof supabaseServer>>

/** Ödenen taksit kaydının masrafa yazılması için gereken alanları */
type OdenenSatir = {
  birim: string
  kalem: string
  sira: number
  tutar: number | string | null
  odeme_tarihi: string | null
  belge_no?: string | null
  gider_id: string | null
}

function tazele() {
  revalidatePath('/finans/kiralar')
  revalidatePath('/finans/gider')
  revalidatePath('/finans/odeme-plani')
}

/**
 * Masraf defterindeki nokta adı: "GÖKSU KANTİN İL PAYI".
 *
 * Kalem adlarının kısası kullanılıyor; "Elektrik, Su ve Isınma Giderleri"
 * nokta adı olarak defterde okunmuyor.
 */
const MASRAF_ETIKETI: Record<Kalem, string> = {
  kira: 'KİRA',
  il_payi: 'İL PAYI',
  ilce_payi: 'İLÇE PAYI',
  uc_aylik: 'ARZ BEDELİ',
  giderler: 'GİDER KATKISI',
}

function masrafNoktasi(birim: string, kalem: string): string {
  const etiket = MASRAF_ETIKETI[kalem as Kalem] ?? kalem.toLocaleUpperCase('tr')
  return `${birim} ${etiket}`
}

function masrafAciklamasi(kalem: string, sira: number, belgeNo?: string | null): string {
  const ad = KALEM_ADLARI[kalem as Kalem] ?? kalem
  return `${ad} — ${sira}. taksit` + (belgeNo ? ` · Belge ${belgeNo}` : '')
}

/**
 * Ödenen taksiti günlük masraf defterine yazar, yazdığı satırın id'sini döner.
 *
 * Faturalardaki kurgunun aynısı: bağlı satır varsa güncelleniyor, yoksa
 * açılıyor — iki kez "ödendi" denince defterde iki satır birikmesin.
 *
 * Tutarı sıfır ya da tarihi boş olan taksit yazılmıyor: rakamı girilmemiş
 * bir satır deftere 0 TL olarak düşmemeli. O durumda kayıt yine "ödendi"
 * kalıyor, tutar girilip tekrar işaretlenince masrafa düşüyor.
 */
async function masrafaYaz(
  supabase: Baglanti,
  kira: OdenenSatir,
): Promise<{ giderId?: string | null; hata?: string }> {
  const tutar = Number(kira.tutar ?? 0)
  if (!(tutar > 0) || !kira.odeme_tarihi) return { giderId: kira.gider_id ?? null }

  const yama = {
    tarih: kira.odeme_tarihi,
    tutar,
    masraf_noktasi: masrafNoktasi(kira.birim, kira.kalem),
    aciklama: masrafAciklamasi(kira.kalem, kira.sira, kira.belge_no),
  }

  if (kira.gider_id) {
    const { error } = await supabase.from('gunluk_gider').update(yama).eq('id', kira.gider_id)
    if (error) return { hata: error.message }
    return { giderId: kira.gider_id }
  }

  const { data, error } = await supabase
    .from('gunluk_gider')
    .insert(yama)
    .select('id')
    .single()
  if (error) return { hata: error.message }
  return { giderId: (data as { id: string }).id }
}

/** Taksite bağlı masraf satırını kaldırır */
async function masrafiSil(supabase: Baglanti, giderId: string | null | undefined) {
  if (giderId) await supabase.from('gunluk_gider').delete().eq('id', giderId)
}

/**
 * Bir satırın tutar / tarih / belge bilgisi.
 *
 * Satırlar önceden açılmıyor: ekran taksit listesini kendi üretiyor, kayıt
 * ancak bir değer girilince oluşuyor. Bu yüzden upsert.
 */
const semaSatir = z.object({
  birim: z.string().trim().min(1, 'Birim gerekli.'),
  kalem: z.enum(['kira', 'il_payi', 'ilce_payi', 'uc_aylik', 'giderler']),
  sira: z.number().int().min(1).max(8),
  tutar: trSayi({ min: 0 }),
  odeme_tarihi: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  belge_no: bosNull,
})

export async function kiraKaydet(veri: {
  birim: string
  kalem: string
  sira: number
  tutar: string
  odeme_tarihi: string | null
  belge_no: string
}): Promise<KiraDurumu> {
  const sonuc = semaSatir.safeParse({
    ...veri,
    odeme_tarihi: veri.odeme_tarihi || null,
  })
  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? 'Girilen değerlerde hata var.' }
  }

  const supabase = await supabaseServer()
  const { data: yazilan, error } = await supabase
    .from('kiralar')
    .upsert(sonuc.data, { onConflict: 'birim,kalem,sira' })
    .select('birim, kalem, sira, tutar, odeme_tarihi, belge_no, odendi, gider_id')
    .single()

  if (error) return { hata: error.message }

  // Ödenmiş satırın tutarı ya da tarihi değiştiyse defterdeki karşılığı da
  // güncellensin; yoksa masraf defteri kiralardan sapar.
  const kayit = yazilan as (OdenenSatir & { odendi: boolean }) | null
  if (kayit?.odendi) {
    const masraf = await masrafaYaz(supabase, kayit)
    if (masraf.hata) return { hata: masraf.hata }
    if ((masraf.giderId ?? null) !== (kayit.gider_id ?? null)) {
      await supabase
        .from('kiralar')
        .update({ gider_id: masraf.giderId ?? null })
        .eq('birim', kayit.birim)
        .eq('kalem', kayit.kalem)
        .eq('sira', kayit.sira)
    }
  }

  tazele()
  return { basari: 'Kaydedildi.' }
}

/**
 * Ödendi işareti.
 *
 * Satır henüz yoksa önce açılır: kullanıcı tutarı sonradan girebilir,
 * "ödendi" demek için tutar girmek zorunda kalmamalı.
 *
 * Ödendi denince aynı tutar günlük masraf defterine de yazılıyor; işaret
 * kalkınca o satır siliniyor. Masrafı ayrıca elle girmek gerekmesin.
 */
export async function odendiDegistir(
  veri: { birim: string; kalem: string; sira: number },
  odendi: boolean,
  /** Kayıtta tarih yoksa işaretleme anında yazılacak tarih */
  varsayilanTarih?: string | null,
): Promise<KiraDurumu> {
  const supabase = await supabaseServer()

  const { data: eski } = await supabase
    .from('kiralar')
    .select('tutar, odeme_tarihi, belge_no, gider_id')
    .eq('birim', veri.birim)
    .eq('kalem', veri.kalem)
    .eq('sira', veri.sira)
    .maybeSingle()

  const kayit = eski as {
    tutar?: number | string | null
    odeme_tarihi?: string | null
    belge_no?: string | null
    gider_id?: string | null
  } | null

  // İşaret kalkınca deftere düşen satır da gitsin: ödeme geri alındı.
  if (!odendi) {
    await masrafiSil(supabase, kayit?.gider_id)
    const { error } = await supabase
      .from('kiralar')
      .upsert({ ...veri, odendi: false, gider_id: null }, { onConflict: 'birim,kalem,sira' })
    if (error) return { hata: error.message }

    tazele()
    return { basari: 'Ödendi işareti kaldırıldı; günlük masraftaki satır da silindi.' }
  }

  // Tarih boşsa ekranda duran varsayılan tarih kaydedilir; kullanıcı ayrıca
  // tarih kutusuna dokunmak zorunda kalmasın.
  const tarih = kayit?.odeme_tarihi ?? varsayilanTarih ?? null

  const sonuc = await masrafaYaz(supabase, {
    ...veri,
    tutar: kayit?.tutar ?? 0,
    odeme_tarihi: tarih,
    belge_no: kayit?.belge_no ?? null,
    gider_id: kayit?.gider_id ?? null,
  })
  if (sonuc.hata) return { hata: sonuc.hata }

  const { error } = await supabase.from('kiralar').upsert(
    {
      ...veri,
      odendi: true,
      ...(tarih ? { odeme_tarihi: tarih } : {}),
      gider_id: sonuc.giderId ?? null,
    },
    { onConflict: 'birim,kalem,sira' },
  )

  if (error) return { hata: error.message }

  tazele()
  return {
    basari: sonuc.giderId
      ? 'Ödendi olarak işaretlendi, günlük masrafa yazıldı.'
      : 'Ödendi olarak işaretlendi. Tutar girilince günlük masrafa da düşecek.',
  }
}

/**
 * Bir kalemin verilen taksitlerine aynı tutarı yazar.
 *
 * Ödenmiş satır atlanır: olmuş bitmiş bir ödeme sonradan yapılan bir
 * hesaplamayla değişmemeli.
 */
async function kalemYaz(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  birim: string,
  kalem: string,
  tutar: number,
  siralar: number[],
): Promise<{ hata?: string; yazilan: number; atlanan: number }> {
  const { data, error } = await supabase
    .from('kiralar')
    .select('id, sira, odendi')
    .eq('birim', birim)
    .eq('kalem', kalem)

  if (error) return { hata: error.message, yazilan: 0, atlanan: 0 }

  const mevcut = new Map(
    ((data ?? []) as { id: string; sira: number; odendi: boolean }[]).map((r) => [r.sira, r]),
  )

  const eklenecek: Record<string, unknown>[] = []
  let yazilan = 0
  let atlanan = 0

  for (const sira of siralar) {
    const r = mevcut.get(sira)
    if (r?.odendi) {
      atlanan++
      continue
    }

    if (r) {
      const { error: guncelleme } = await supabase.from('kiralar').update({ tutar }).eq('id', r.id)
      if (guncelleme) return { hata: guncelleme.message, yazilan, atlanan }
    } else {
      eklenecek.push({ birim, kalem, sira, tutar })
    }
    yazilan++
  }

  if (eklenecek.length > 0) {
    const { error: ekleme } = await supabase.from('kiralar').insert(eklenecek)
    if (ekleme) return { hata: ekleme.message, yazilan, atlanan }
  }

  return { yazilan, atlanan }
}

/**
 * Kira bedelini (taban) saklar ve kalemleri ondan hesaplayıp yazar.
 *
 * Hesap sunucuda yeniden yapılıyor; ekranın gösterdiği rakamlara
 * güvenilmiyor. Grup tanımı ekrandan geliyor çünkü hangi kalemin hangi
 * birimde durduğu ekrandaki düzenin bir parçası: AKBABA'da kira iki okula
 * bölünüyor, il/ilçe ve arz tek birimde yatıyor.
 */
export async function hesaplaDoldur(veri: {
  tabanAnahtari: string
  /** Kira bu birimlere eşit bölünür */
  kiraAnahtarlari: string[]
  /** İl payı, ilçe payı ve arz bu birimlere eşit bölünür */
  paylarAnahtarlari: string[]
  taban: string
  /** Yeni tabanın geçerli olduğu ilk taksit; öncesi olduğu gibi kalır */
  baslangic: number
}): Promise<KiraDurumu> {
  const sonuc = z
    .object({
      tabanAnahtari: z.string().trim().min(1),
      kiraAnahtarlari: z.array(z.string().trim().min(1)).min(1),
      paylarAnahtarlari: z.array(z.string().trim().min(1)).min(1),
      taban: trSayi({ min: 1 }),
      baslangic: z.number().int().min(1).max(TAKSIT_SAYISI),
    })
    .safeParse(veri)

  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? 'Kira bedelini kontrol et.' }
  }

  const { tabanAnahtari, kiraAnahtarlari, paylarAnahtarlari, taban, baslangic } = sonuc.data
  const kirilim = kiraKirilimi(taban, kiraAnahtarlari.length, paylarAnahtarlari.length)

  const supabase = await supabaseServer()

  // Taban kademe olarak saklanıyor: "bu taksitten itibaren kira şu"
  const { error: tabanHatasi } = await supabase
    .from('kira_tabanlari')
    .upsert(
      { anahtar: tabanAnahtari, sira: baslangic, tutar: taban },
      { onConflict: 'anahtar,sira' },
    )
  if (tabanHatasi) return { hata: tabanHatasi.message }

  const { data: kademeVerisi, error: kademeHatasi } = await supabase
    .from('kira_tabanlari')
    .select('sira, tutar')
    .eq('anahtar', tabanAnahtari)
  if (kademeHatasi) return { hata: kademeHatasi.message }

  const kademeler = ((kademeVerisi ?? []) as { sira: number; tutar: number | string }[]).map(
    (k) => ({ sira: k.sira, tutar: Number(k.tutar) }),
  )

  // Bu kademe yalnız kendi aralığını yazar: sonraki kademe başlıyorsa orada
  // durur, yoksa son taksite kadar gider. Aksi hâlde eski kademeyi
  // hesaplatmak sonraki zammı silip süpürürdü.
  const aralik = kademeAraliklari(kademeler).find((a) => a.baslangic === baslangic)
  const bitis = aralik?.bitis ?? TAKSIT_SAYISI
  const hedefler = Array.from({ length: bitis - baslangic + 1 }, (_, i) => baslangic + i)

  const isler = [
    ...kiraAnahtarlari.map((birim) => ({
      birim,
      kalem: 'kira',
      tutar: kirilim.kiraBirimBasina,
      siralar: hedefler,
    })),
    ...paylarAnahtarlari.flatMap((birim) => [
      { birim, kalem: 'il_payi', tutar: kirilim.ilPayiBirim, siralar: hedefler },
      { birim, kalem: 'ilce_payi', tutar: kirilim.ilcePayiBirim, siralar: hedefler },
      // Arz da öbür kalemler gibi: her taksitte aynı rakam
      { birim, kalem: 'uc_aylik', tutar: kirilim.arzBirim, siralar: hedefler },
    ]),
  ]

  let yazilan = 0
  let atlanan = 0
  for (const is of isler) {
    const r = await kalemYaz(supabase, is.birim, is.kalem, is.tutar, is.siralar)
    if (r.hata) return { hata: r.hata }
    yazilan += r.yazilan
    atlanan += r.atlanan
  }

  revalidatePath('/finans/kiralar')
  return {
    basari:
      `${baslangic}–${bitis}. taksit hesaplandı (${yazilan} satır).` +
      (atlanan > 0 ? ` ${atlanan} ödenmiş satıra dokunulmadı.` : ''),
  }
}

/**
 * Bir kira değişikliğini (kademeyi) kaldırır.
 *
 * Yazılmış taksit satırlarına dokunulmuyor: hangi rakamın geçerli olacağına
 * kullanıcı karar versin, kaldırdıktan sonra önceki kademeyi hesaplatarak
 * aralığı yeniden yazabilir.
 */
export async function kademeSil(anahtar: string, sira: number): Promise<KiraDurumu> {
  if (sira === 1) return { hata: 'İlk kademe kaldırılamaz; rakamı değiştirebilirsiniz.' }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('kira_tabanlari')
    .delete()
    .eq('anahtar', anahtar)
    .eq('sira', sira)

  if (error) return { hata: error.message }

  revalidatePath('/finans/kiralar')
  return { basari: `${sira}. taksitteki kira değişikliği kaldırıldı.` }
}

/**
 * Girilen tutarı sonraki taksitlere yayar.
 *
 * Kira her taksitte aynı; sekiz taksiti tek tek yazmak gereksiz. Ortada zam
 * gelirse o taksite yeni rakam girilir ve ondan sonrası da yeni rakama döner.
 *
 * Ödenmiş satırlara dokunulmaz: onlar olmuş bitmiş bir ödeme, sonradan
 * girilen bir rakam geçmişi değiştirmemeli.
 */
export async function tutarYay(
  birim: string,
  kalem: string,
  tutar: number,
  siralar: number[],
): Promise<KiraDurumu & { yazilan?: number }> {
  if (siralar.length === 0) return { basari: 'Yayılacak taksit yok.' }

  const supabase = await supabaseServer()
  const sonuc = await kalemYaz(supabase, birim, kalem, tutar, siralar)
  if (sonuc.hata) return { hata: sonuc.hata }

  revalidatePath('/finans/kiralar')
  return { basari: `${sonuc.yazilan} taksite yazıldı.`, yazilan: sonuc.yazilan }
}

/**
 * Yüklenmiş bir dekont dosyasını kayda bağlar.
 *
 * Dosya tarayıcıdan doğrudan kovaya gidiyor (sözleşmelerde olduğu gibi);
 * burada yalnızca kaydı ve kapsadığı taksitleri yazıyoruz.
 *
 * Bir taksitin tek dekontu olur. Zaten dekontu olan bir satır seçilirse
 * veritabanındaki benzersiz kısıt itiraz eder; o yüzden ekran o satırları
 * kilitli gösteriyor, burada da hata metni anlaşılır hâle getiriliyor.
 */
export async function dekontKaydet(veri: {
  birim: string
  dosyaYolu: string
  dosyaAdi: string
  odemeTarihi: string | null
  tutar: number | null
  aciklama: string | null
  kiraIdleri: string[]
  /** Seçilen taksitler aynı anda ödendi işaretlensin mi */
  odendiIsaretle: boolean
}): Promise<KiraDurumu> {
  if (veri.kiraIdleri.length === 0)
    return { hata: 'Dekontun kapsadığı en az bir taksit seçilmeli.' }

  const supabase = await supabaseServer()

  const { data: dekont, error: hataDekont } = await supabase
    .from('kira_dekontlari')
    .insert({
      birim: veri.birim,
      dosya_yolu: veri.dosyaYolu,
      dosya_adi: veri.dosyaAdi,
      odeme_tarihi: veri.odemeTarihi,
      tutar: veri.tutar,
      aciklama: veri.aciklama,
    })
    .select('id')
    .single()

  if (hataDekont || !dekont) return { hata: hataDekont?.message ?? 'Dekont kaydedilemedi.' }

  const { error: hataBag } = await supabase
    .from('kira_dekont_satirlari')
    .insert(veri.kiraIdleri.map((kira_id) => ({ dekont_id: dekont.id, kira_id })))

  if (hataBag) {
    // Bağlantı kurulamadıysa dekont kaydı ortada kalmasın
    await supabase.from('kira_dekontlari').delete().eq('id', dekont.id)
    return {
      hata: hataBag.code === '23505'
        ? 'Seçilen taksitlerden birinde zaten dekont var; önce onu kaldırın.'
        : hataBag.message,
    }
  }

  let masrafaDusen = 0

  if (veri.odendiIsaretle) {
    const guncelleme: { odendi: boolean; odeme_tarihi?: string } = { odendi: true }
    if (veri.odemeTarihi) guncelleme.odeme_tarihi = veri.odemeTarihi

    const { data: isaretli } = await supabase
      .from('kiralar')
      .update(guncelleme)
      .in('id', veri.kiraIdleri)
      .select('id, birim, kalem, sira, tutar, odeme_tarihi, belge_no, gider_id')

    // Dekontla ödendi işaretlenen her taksit günlük masrafa da düşsün —
    // "ödendi" tikini tek tek koymakla dekont yüklemek aynı şey.
    for (const satir of (isaretli ?? []) as (OdenenSatir & { id: string })[]) {
      const masraf = await masrafaYaz(supabase, satir)
      if (masraf.hata) return { hata: masraf.hata }
      if (masraf.giderId) {
        masrafaDusen++
        if (masraf.giderId !== satir.gider_id) {
          await supabase
            .from('kiralar')
            .update({ gider_id: masraf.giderId })
            .eq('id', satir.id)
        }
      }
    }
  }

  tazele()
  return {
    basari:
      `Dekont kaydedildi; ${veri.kiraIdleri.length} taksite bağlandı.` +
      (masrafaDusen > 0 ? ` ${masrafaDusen} satır günlük masrafa yazıldı.` : ''),
  }
}

/**
 * Dekontu ve bağlantılarını kaldırır.
 *
 * Taksitlerin "ödendi" işaretine dokunulmuyor: ödeme olmuş, kaybolan
 * yalnızca belgesi. Tiki kullanıcı isterse kendi kaldırır.
 */
export async function dekontSil(id: string): Promise<KiraDurumu> {
  const supabase = await supabaseServer()

  const { data: dekont } = await supabase
    .from('kira_dekontlari')
    .select('dosya_yolu')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('kira_dekontlari').delete().eq('id', id)
  if (error) return { hata: error.message }

  const yol = (dekont as { dosya_yolu?: string } | null)?.dosya_yolu
  if (yol) await supabase.storage.from(DEKONT_KOVASI).remove([yol])

  revalidatePath('/finans/kiralar')
  return { basari: 'Dekont kaldırıldı.' }
}
