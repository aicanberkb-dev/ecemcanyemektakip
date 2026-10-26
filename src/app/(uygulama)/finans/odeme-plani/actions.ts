'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

export type PlanDurumu = { hata?: string; basari?: string }

function tazele() {
  revalidatePath('/finans/odeme-plani')
  revalidatePath('/finans/gider')
}

function sayiya(metin: string): number {
  return Number((metin || '').replace(/\./g, '').replace(',', '.'))
}

/**
 * Takvime elle kalem ekler.
 *
 * Maaş, senet, SGK ve faturalar kendi ekranlarından geliyor; burası onların
 * dışında kalan ödemeler için — kira farkı, tek seferlik borç, avans.
 */
export async function planEkle(veri: {
  vade_tarihi: string
  kime: string
  tutar: string
  aciklama: string
}): Promise<PlanDurumu> {
  const kime = veri.kime.trim().replace(/\s+/g, ' ')
  if (!kime) return { hata: 'Kime ödeneceğini yazın.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(veri.vade_tarihi)) return { hata: 'Vade tarihi gerekli.' }

  const tutar = sayiya(veri.tutar)
  if (!Number.isFinite(tutar) || tutar <= 0) return { hata: 'Geçerli bir tutar girin.' }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('odeme_plani').insert({
    vade_tarihi: veri.vade_tarihi,
    kime: kime.toLocaleUpperCase('tr'),
    tutar,
    aciklama: veri.aciklama.trim() || null,
  })
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Takvime eklendi.' }
}

export async function planSil(id: string): Promise<PlanDurumu> {
  const supabase = await supabaseServer()

  const { data } = await supabase
    .from('odeme_plani')
    .select('gider_id')
    .eq('id', id)
    .maybeSingle()
  const giderId = (data as { gider_id?: string | null } | null)?.gider_id
  if (giderId) await supabase.from('gunluk_gider').delete().eq('id', giderId)

  const { error } = await supabase.from('odeme_plani').delete().eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Silindi.' }
}

/**
 * Elle eklenen kalemi ödendi işaretler; tutar günlük masrafa da yazılır.
 */
export async function planOdendi(
  id: string,
  odendi: boolean,
  bugun: string,
): Promise<PlanDurumu> {
  const supabase = await supabaseServer()

  const { data } = await supabase
    .from('odeme_plani')
    .select('kime, tutar, aciklama, gider_id')
    .eq('id', id)
    .maybeSingle()
  if (!data) return { hata: 'Kayıt bulunamadı.' }

  const kayit = data as {
    kime: string
    tutar: number | string
    aciklama: string | null
    gider_id: string | null
  }

  if (!odendi) {
    if (kayit.gider_id) await supabase.from('gunluk_gider').delete().eq('id', kayit.gider_id)
    const { error } = await supabase
      .from('odeme_plani')
      .update({ odendi: false, odeme_tarihi: null, gider_id: null })
      .eq('id', id)
    if (error) return { hata: error.message }

    tazele()
    return { basari: 'Ödendi işareti kaldırıldı.' }
  }

  let giderId = kayit.gider_id
  const gider = {
    tarih: bugun,
    tutar: Number(kayit.tutar),
    masraf_noktasi: kayit.kime,
    aciklama: kayit.aciklama,
  }

  if (giderId) {
    const { error } = await supabase.from('gunluk_gider').update(gider).eq('id', giderId)
    if (error) return { hata: error.message }
  } else {
    const { data: yeni, error } = await supabase
      .from('gunluk_gider')
      .insert(gider)
      .select('id')
      .single()
    if (error) return { hata: error.message }
    giderId = (yeni as { id: string }).id
  }

  const { error } = await supabase
    .from('odeme_plani')
    .update({ odendi: true, odeme_tarihi: bugun, gider_id: giderId })
    .eq('id', id)
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Ödendi, günlük masrafa yazıldı.' }
}
