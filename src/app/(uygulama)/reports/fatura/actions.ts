'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

import type { AliciTipi } from './alici'

export type FaturaDurumu = { hata?: string; basari?: string }

/**
 * "Bu dönem için fatura kesildi" işaretini açar ya da kaldırır.
 *
 * Tutar kesildiği anda kopyalanır: sonradan gelen tahsilat kesilmiş faturanın
 * rakamını değiştirmesin.
 */
export async function faturaKesildiDegistir(
  studentId: string,
  donemBas: string,
  donemBit: string,
  tutar: number,
  kesildi: boolean,
): Promise<FaturaDurumu> {
  const supabase = await supabaseServer()

  if (kesildi) {
    const { error } = await supabase
      .from('ogrenci_faturalari')
      .upsert(
        { student_id: studentId, donem_bas: donemBas, donem_bit: donemBit, tutar },
        { onConflict: 'student_id,donem_bas,donem_bit' },
      )
    if (error) return { hata: error.message }
  } else {
    const { error } = await supabase
      .from('ogrenci_faturalari')
      .delete()
      .eq('student_id', studentId)
      .eq('donem_bas', donemBas)
      .eq('donem_bit', donemBit)
    if (error) return { hata: error.message }
  }

  revalidatePath('/reports/fatura')
  return { basari: kesildi ? 'Kesildi olarak işaretlendi.' : 'İşaret kaldırıldı.' }
}

/**
 * Faturanın kime kesileceğini kaydeder.
 *
 * Veli seçildiyse ad ve vergi numarası anaveriden okunuyor, burada
 * saklanmıyor: veli bilgisi değişince fatura alıcısı da kendiliğinden
 * güncellensin. "Diğer" ise ad ve vergi bilgileri burada duruyor.
 */
export async function faturaAliciKaydet(
  studentId: string,
  veri: {
    tip: AliciTipi
    ad?: string
    vergi_no?: string
    vergi_dairesi?: string
    adres?: string
  },
): Promise<FaturaDurumu> {
  const bosNull = (d?: string) => {
    const t = (d ?? '').trim()
    return t === '' ? null : t
  }

  if (veri.tip === 'diger' && !bosNull(veri.ad)) {
    return { hata: 'Başka kişi/kurum seçtiyseniz ad ya da unvan gerekli.' }
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('fatura_alicilari').upsert(
    {
      student_id: studentId,
      tip: veri.tip,
      // Veli ya da öğrenci seçildiyse serbest alanlar temizlenir;
      // yarım kalmış eski bilgi faturaya sızmasın
      ad: veri.tip === 'diger' ? bosNull(veri.ad) : null,
      vergi_no: veri.tip === 'diger' ? bosNull(veri.vergi_no) : null,
      vergi_dairesi: veri.tip === 'diger' ? bosNull(veri.vergi_dairesi) : null,
      adres: veri.tip === 'diger' ? bosNull(veri.adres) : null,
    },
    { onConflict: 'student_id' },
  )

  if (error) return { hata: error.message }

  revalidatePath('/reports/fatura')
  return { basari: 'Fatura alıcısı kaydedildi.' }
}
