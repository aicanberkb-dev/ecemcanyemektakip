'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

import { ozetiYenile } from './ozet'

export type OdemeDurumu = { hata?: string; basari?: string }

function tazele() {
  revalidatePath('/finans/maaslar')
  revalidatePath('/finans/gider')
  revalidatePath('/finans/odeme-plani')
  revalidatePath('/maliyet/kar-zarar')
}

/**
 * Bir maaş ödemesi ekler — tamamı ya da bir parçası.
 *
 * Her ödeme kendi tarihiyle günlük masraf defterine de yazılıyor: 10'unda
 * yapılan ödeme 10'una, 25'inde yapılan 25'ine düşer. Masraf satırının
 * id'si harekette tutuluyor ki ödeme silinince aynı satır silinsin.
 */
export async function maasOdemeEkle(
  personelId: string,
  yil: number,
  ay: number,
  tutar: number,
  tarih: string,
  aciklama?: string,
): Promise<OdemeDurumu> {
  if (!Number.isFinite(tutar) || tutar <= 0) return { hata: 'Geçerli bir tutar girin.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { hata: 'Ödeme tarihi gerekli.' }

  const supabase = await supabaseServer()

  const { data: personel } = await supabase
    .from('personeller')
    .select('ad')
    .eq('id', personelId)
    .maybeSingle()
  const ad = (personel as { ad?: string } | null)?.ad ?? 'Personel'

  const donemYazi = `${String(ay).padStart(2, '0')}.${yil}`
  const not = aciklama?.trim()
  const { data: yeniGider, error: giderHatasi } = await supabase
    .from('gunluk_gider')
    .insert({
      tarih,
      tutar,
      masraf_noktasi: 'MAAŞ',
      aciklama: `Maaş — ${ad} · ${donemYazi}` + (not ? ` · ${not}` : ''),
    })
    .select('id')
    .single()
  if (giderHatasi) return { hata: giderHatasi.message }

  const { error } = await supabase.from('maas_odeme_hareketleri').insert({
    personel_id: personelId,
    donem_yil: yil,
    donem_ay: ay,
    tarih,
    tutar,
    aciklama: not || null,
    gider_id: (yeniGider as { id: string }).id,
  })
  if (error) {
    // Hareket yazılamadıysa masraf satırı ortada kalmasın
    await supabase.from('gunluk_gider').delete().eq('id', (yeniGider as { id: string }).id)
    return { hata: error.message }
  }

  const ozetHatasi = await ozetiYenile(supabase, personelId, yil, ay)
  if (ozetHatasi) return { hata: ozetHatasi }

  tazele()
  return { basari: 'Ödeme eklendi, günlük masrafa yazıldı.' }
}

/** Tek bir ödemeyi (parçayı) siler; masraf satırı da gider */
export async function maasOdemeSil(hareketId: string): Promise<OdemeDurumu> {
  const supabase = await supabaseServer()

  const { data } = await supabase
    .from('maas_odeme_hareketleri')
    .select('personel_id, donem_yil, donem_ay, gider_id')
    .eq('id', hareketId)
    .maybeSingle()
  if (!data) return { hata: 'Ödeme bulunamadı; sayfayı yenileyin.' }

  const h = data as {
    personel_id: string
    donem_yil: number
    donem_ay: number
    gider_id: string | null
  }

  if (h.gider_id) await supabase.from('gunluk_gider').delete().eq('id', h.gider_id)

  const { error } = await supabase.from('maas_odeme_hareketleri').delete().eq('id', hareketId)
  if (error) return { hata: error.message }

  const ozetHatasi = await ozetiYenile(supabase, h.personel_id, h.donem_yil, h.donem_ay)
  if (ozetHatasi) return { hata: ozetHatasi }

  tazele()
  return { basari: 'Ödeme silindi, masraf satırı da kaldırıldı.' }
}
