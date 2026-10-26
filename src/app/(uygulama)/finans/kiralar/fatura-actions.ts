'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

import { GIDER_ADLARI, type GiderTuru } from './gider-turleri'

export type FaturaDurumu = { hata?: string; basari?: string }

/** Masraf defterinde görünecek nokta adı: "GÖKSU ELEKTRİK" */
function masrafNoktasi(yer: string, tur: GiderTuru): string {
  return `${yer} ${GIDER_ADLARI[tur].toLocaleUpperCase('tr')}`
}

function tazele() {
  revalidatePath('/finans/kiralar')
  revalidatePath('/finans/gider')
  revalidatePath('/finans/odeme-plani')
}

/** Türkçe biçimli tutarı sayıya çevirir */
function sayiya(metin: string): number {
  const n = Number((metin || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Aboneliğin sözleşme numarası ve vade günü.
 *
 * Bir kez giriliyor, her ay tekrar sorulmuyor. Vade günü ayın kaçında
 * ödendiğini söylüyor; haftalık ödeme takvimi bunu kullanıyor.
 */
export async function abonelikKaydet(
  yer: string,
  tur: GiderTuru,
  alan: 'sozlesme_no' | 'vade_gunu',
  deger: string,
): Promise<FaturaDurumu> {
  let değer: string | number | null = deger.trim() || null

  if (alan === 'vade_gunu' && değer !== null) {
    const g = Number(değer)
    if (!Number.isInteger(g) || g < 1 || g > 31)
      return { hata: 'Vade günü 1 ile 31 arasında olmalı.' }
    değer = g
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('fatura_abonelikleri')
    .upsert({ yer, gider_turu: tur, [alan]: değer }, { onConflict: 'yer,gider_turu' })

  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

/** Dönemin tutarını ya da ödeme tarihini yazar */
export async function faturaKaydet(
  yer: string,
  tur: GiderTuru,
  donem: string,
  alan: 'tutar' | 'odeme_tarihi',
  deger: string,
): Promise<FaturaDurumu> {
  const yama: Record<string, unknown> = {}

  if (alan === 'tutar') {
    const t = sayiya(deger)
    if (deger.trim() !== '' && (!Number.isFinite(t) || t < 0))
      return { hata: 'Geçerli bir tutar girin.' }
    yama.tutar = deger.trim() === '' ? 0 : t
  } else {
    yama.odeme_tarihi = deger.trim() || null
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('fatura_odemeleri')
    .upsert({ yer, gider_turu: tur, donem, ...yama }, { onConflict: 'yer,gider_turu,donem' })

  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Kaydedildi.' }
}

/**
 * Faturayı ödendi işaretler ya da geri alır.
 *
 * Ödendi derken aynı tutar günlük masrafa da yazılıyor — masrafı ayrıca
 * elle girmek gerekmesin. Geri alınca o masraf satırı siliniyor.
 */
export async function faturaOdendi(
  yer: string,
  tur: GiderTuru,
  donem: string,
  odendi: boolean,
  varsayilanTarih: string,
): Promise<FaturaDurumu> {
  const supabase = await supabaseServer()

  const { data: mevcut } = await supabase
    .from('fatura_odemeleri')
    .select('id, tutar, odeme_tarihi, gider_id')
    .eq('yer', yer)
    .eq('gider_turu', tur)
    .eq('donem', donem)
    .maybeSingle()

  const kayit = mevcut as {
    id: string
    tutar: number | string
    odeme_tarihi: string | null
    gider_id: string | null
  } | null

  // Geri alma: masraf satırı da gitsin
  if (!odendi) {
    if (kayit?.gider_id) await supabase.from('gunluk_gider').delete().eq('id', kayit.gider_id)
    const { error } = await supabase
      .from('fatura_odemeleri')
      .upsert(
        { yer, gider_turu: tur, donem, odendi: false, gider_id: null },
        { onConflict: 'yer,gider_turu,donem' },
      )
    if (error) return { hata: error.message }

    tazele()
    return { basari: 'Ödendi işareti kaldırıldı.' }
  }

  const tutar = Number(kayit?.tutar ?? 0)
  if (!(tutar > 0)) return { hata: 'Önce faturanın tutarını girin.' }

  const tarih = kayit?.odeme_tarihi ?? varsayilanTarih

  // Sözleşme numarası masraf açıklamasına da yazılıyor: defterden bakarken
  // hangi aboneliğin faturası olduğu belli olsun.
  const { data: abonelik } = await supabase
    .from('fatura_abonelikleri')
    .select('sozlesme_no')
    .eq('yer', yer)
    .eq('gider_turu', tur)
    .maybeSingle()

  const sozlesme = (abonelik as { sozlesme_no?: string | null } | null)?.sozlesme_no
  const [yil, ay] = donem.split('-')
  const aciklama =
    `${GIDER_ADLARI[tur]} faturası — ${ay}.${yil}` + (sozlesme ? ` · Söz. ${sozlesme}` : '')

  // Eski masraf satırı varsa güncelleniyor, yoksa yenisi açılıyor: iki kez
  // ödendi denince defterde iki satır birikmesin.
  let giderId = kayit?.gider_id ?? null
  if (giderId) {
    const { error } = await supabase
      .from('gunluk_gider')
      .update({ tarih, tutar, masraf_noktasi: masrafNoktasi(yer, tur), aciklama })
      .eq('id', giderId)
    if (error) return { hata: error.message }
  } else {
    const { data: yeni, error } = await supabase
      .from('gunluk_gider')
      .insert({ tarih, tutar, masraf_noktasi: masrafNoktasi(yer, tur), aciklama })
      .select('id')
      .single()
    if (error) return { hata: error.message }
    giderId = (yeni as { id: string }).id
  }

  const { error } = await supabase.from('fatura_odemeleri').upsert(
    { yer, gider_turu: tur, donem, odendi: true, odeme_tarihi: tarih, gider_id: giderId },
    { onConflict: 'yer,gider_turu,donem' },
  )
  if (error) return { hata: error.message }

  tazele()
  return { basari: 'Ödendi olarak işaretlendi, günlük masrafa yazıldı.' }
}
