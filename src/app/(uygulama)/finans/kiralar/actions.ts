'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type KiraDurumu = { hata?: string; basari?: string }

/**
 * Bir satırın tutar / tarih / belge bilgisi.
 *
 * Satırlar önceden açılmıyor: ekran dönem listesini kendi üretiyor, kayıt
 * ancak bir değer girilince oluşuyor. Bu yüzden upsert.
 */
const semaSatir = z.object({
  birim: z.string().trim().min(1, 'Birim gerekli.'),
  kalem: z.enum(['kira', 'il_payi', 'ilce_payi', 'uc_aylik']),
  donem: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  sira: z.number().int().min(1).max(3).nullable(),
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
  donem: string | null
  sira: number | null
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
    .upsert(sonuc.data, {
      onConflict: 'birim,kalem,donem,sira',
    })

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
  veri: { birim: string; kalem: string; donem: string | null; sira: number | null },
  odendi: boolean,
  /** Kayıtta tarih yoksa işaretleme anında yazılacak tarih */
  varsayilanTarih?: string | null,
): Promise<KiraDurumu> {
  const supabase = await supabaseServer()

  let sorgu = supabase
    .from('kiralar')
    .select('odeme_tarihi')
    .eq('birim', veri.birim)
    .eq('kalem', veri.kalem)
  sorgu = veri.donem ? sorgu.eq('donem', veri.donem) : sorgu.eq('sira', veri.sira!)
  const { data: eski } = await sorgu.maybeSingle()

  // Ödendi derken tarih boşsa ekranda duran varsayılan tarih kaydedilir;
  // kullanıcı ayrıca tarih kutusuna dokunmak zorunda kalmasın.
  const tarih =
    odendi && varsayilanTarih && !(eski as { odeme_tarihi?: string | null } | null)?.odeme_tarihi
      ? { odeme_tarihi: varsayilanTarih }
      : {}

  const { error } = await supabase.from('kiralar').upsert(
    { ...veri, ...tarih, odendi },
    { onConflict: 'birim,kalem,donem,sira' },
  )

  if (error) return { hata: error.message }

  revalidatePath('/finans/kiralar')
  return { basari: odendi ? 'Ödendi olarak işaretlendi.' : 'Ödendi işareti kaldırıldı.' }
}

/**
 * Girilen tutarı sonraki dönemlere yayar.
 *
 * Kira her ay aynı; on ayı tek tek yazmak gereksiz. Ortada bir ay zam
 * gelirse o aya yeni rakam girilir ve ondan sonrası da yeni rakama döner.
 *
 * Ödenmiş satırlara dokunulmaz: onlar olmuş bitmiş bir ödeme, sonradan
 * girilen bir rakam geçmişi değiştirmemeli.
 */
export async function tutarYay(
  birim: string,
  kalem: string,
  tutar: number,
  hedefler: { donem: string | null; sira: number | null }[],
): Promise<KiraDurumu & { yazilan?: number }> {
  if (hedefler.length === 0) return { basari: 'Yayılacak dönem yok.' }

  const supabase = await supabaseServer()
  const { data, error: okumaHatasi } = await supabase
    .from('kiralar')
    .select('id, donem, sira, odendi')
    .eq('birim', birim)
    .eq('kalem', kalem)

  if (okumaHatasi) return { hata: okumaHatasi.message }

  const mevcut = new Map(
    ((data ?? []) as { id: string; donem: string | null; sira: number | null; odendi: boolean }[])
      .map((r) => [`${r.donem ?? ''}|${r.sira ?? ''}`, r]),
  )

  const eklenecek: Record<string, unknown>[] = []
  let yazilan = 0

  for (const h of hedefler) {
    const r = mevcut.get(`${h.donem ?? ''}|${h.sira ?? ''}`)
    if (r?.odendi) continue

    if (r) {
      const { error } = await supabase.from('kiralar').update({ tutar }).eq('id', r.id)
      if (error) return { hata: error.message }
    } else {
      eklenecek.push({ birim, kalem, donem: h.donem, sira: h.sira, tutar })
    }
    yazilan++
  }

  if (eklenecek.length > 0) {
    const { error } = await supabase.from('kiralar').insert(eklenecek)
    if (error) return { hata: error.message }
  }

  revalidatePath('/finans/kiralar')
  return { basari: `${yazilan} döneme yazıldı.`, yazilan }
}
