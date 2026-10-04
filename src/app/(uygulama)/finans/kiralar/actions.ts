'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  arzKapsamlari,
  arzOdemeleri,
  kiraKirilimi,
  taksitTabanlari,
  TAKSIT_SAYISI,
} from '@/lib/kira-hesap'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type KiraDurumu = { hata?: string; basari?: string }

/**
 * Bir satırın tutar / tarih / belge bilgisi.
 *
 * Satırlar önceden açılmıyor: ekran taksit listesini kendi üretiyor, kayıt
 * ancak bir değer girilince oluşuyor. Bu yüzden upsert.
 */
const semaSatir = z.object({
  birim: z.string().trim().min(1, 'Birim gerekli.'),
  kalem: z.enum(['kira', 'il_payi', 'ilce_payi', 'uc_aylik']),
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
  const { error } = await supabase
    .from('kiralar')
    .upsert(sonuc.data, { onConflict: 'birim,kalem,sira' })

  if (error) return { hata: error.message }

  revalidatePath('/finans/kiralar')
  return { basari: 'Kaydedildi.' }
}

/**
 * Ödendi işareti.
 *
 * Satır henüz yoksa önce açılır: kullanıcı tutarı sonradan girebilir,
 * "ödendi" demek için tutar girmek zorunda kalmamalı.
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
    .select('odeme_tarihi')
    .eq('birim', veri.birim)
    .eq('kalem', veri.kalem)
    .eq('sira', veri.sira)
    .maybeSingle()

  // Ödendi derken tarih boşsa ekranda duran varsayılan tarih kaydedilir;
  // kullanıcı ayrıca tarih kutusuna dokunmak zorunda kalmasın.
  const tarih =
    odendi && varsayilanTarih && !(eski as { odeme_tarihi?: string | null } | null)?.odeme_tarihi
      ? { odeme_tarihi: varsayilanTarih }
      : {}

  const { error } = await supabase
    .from('kiralar')
    .upsert({ ...veri, ...tarih, odendi }, { onConflict: 'birim,kalem,sira' })

  if (error) return { hata: error.message }

  revalidatePath('/finans/kiralar')
  return { basari: odendi ? 'Ödendi olarak işaretlendi.' : 'Ödendi işareti kaldırıldı.' }
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
  /** İl payı, ilçe payı ve arz bu birimde durur */
  paylarAnahtari: string
  taban: string
  /** Yeni tabanın geçerli olduğu ilk taksit; öncesi olduğu gibi kalır */
  baslangic: number
}): Promise<KiraDurumu> {
  const sonuc = z
    .object({
      tabanAnahtari: z.string().trim().min(1),
      kiraAnahtarlari: z.array(z.string().trim().min(1)).min(1),
      paylarAnahtari: z.string().trim().min(1),
      taban: trSayi({ min: 1 }),
      baslangic: z.number().int().min(1).max(TAKSIT_SAYISI),
    })
    .safeParse(veri)

  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? 'Kira bedelini kontrol et.' }
  }

  const { tabanAnahtari, kiraAnahtarlari, paylarAnahtari, taban, baslangic } = sonuc.data
  const kirilim = kiraKirilimi(taban, kiraAnahtarlari.length)
  const hedefler = Array.from({ length: TAKSIT_SAYISI - baslangic + 1 }, (_, i) => baslangic + i)

  const supabase = await supabaseServer()

  // Taban kademe olarak saklanıyor: "bu taksitten itibaren kira şu"
  const { error: tabanHatasi } = await supabase
    .from('kira_tabanlari')
    .upsert({ anahtar: tabanAnahtari, sira: baslangic, tutar: taban }, { onConflict: 'anahtar,sira' })
  if (tabanHatasi) return { hata: tabanHatasi.message }

  const { data: kademeVerisi, error: kademeHatasi } = await supabase
    .from('kira_tabanlari')
    .select('sira, tutar')
    .eq('anahtar', tabanAnahtari)
  if (kademeHatasi) return { hata: kademeHatasi.message }

  const kademeler = ((kademeVerisi ?? []) as { sira: number; tutar: number | string }[]).map(
    (k) => ({ sira: k.sira, tutar: Number(k.tutar) }),
  )

  const isler = [
    ...kiraAnahtarlari.map((birim) => ({
      birim,
      kalem: 'kira',
      tutar: kirilim.kiraBirimBasina,
      siralar: hedefler,
    })),
    { birim: paylarAnahtari, kalem: 'il_payi', tutar: kirilim.ilPayi, siralar: hedefler },
    { birim: paylarAnahtari, kalem: 'ilce_payi', tutar: kirilim.ilcePayi, siralar: hedefler },
  ]

  // Arz ödemeleri kapsadıkları taksitlerin tabanlarından çıkıyor; yıl
  // ortasında kira değişirse o ödeme kısmen eski kısmen yeni tabandan
  // hesaplanır. Yalnız değişen taksitlere dokunan ödemeler yazılır.
  const tabanlar = taksitTabanlari(kademeler)
  const odemeler = arzOdemeleri(tabanlar)
  arzKapsamlari().forEach((kapsam, i) => {
    const tutar = odemeler[i]
    if (tutar == null || !kapsam.some((t) => t >= baslangic)) return
    isler.push({ birim: paylarAnahtari, kalem: 'uc_aylik', tutar, siralar: [i + 1] })
  })

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
      `${baslangic}. taksitten itibaren ${yazilan} satır hesaplandı.` +
      (atlanan > 0 ? ` ${atlanan} ödenmiş satıra dokunulmadı.` : ''),
  }
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
