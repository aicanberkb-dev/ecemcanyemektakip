'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

export type OkulsuzGun = {
  id: string
  tarih: string
  hizmet_noktasi_id: string | null
  sebep: string | null
}

export type OkulsuzDurumu = { hata?: string; basari?: string }

type Istemci = Awaited<ReturnType<typeof supabaseServer>>

/** Kapalı gün değişince onu okuyan ekranlar yeniden çizilsin. */
function tazele() {
  revalidatePath('/maliyet/kar-zarar')
  revalidatePath('/menu')
  revalidatePath('/menu/cikti')
  revalidatePath('/pos')
  revalidatePath('/toplu')
  revalidatePath('/reports/devam')
  revalidatePath('/reports/yoklama')
}

/**
 * Bir günü "okul yok" olarak işaretler.
 *
 * Nokta verilmezse gün tüm hizmet yerlerinde kapalı sayılır — resmi tatil
 * böyledir. Tek bir yerde gezi varsa o yerin id'si verilir. Kapalı gün ne
 * kâr/zarar tablosunda görünür ne de genel giderin bölenine girer.
 */
export async function okulYokIsaretle(
  tarih: string,
  hizmetNoktasiId: string | null,
  sebep: string | null,
): Promise<OkulsuzDurumu> {
  const supabase = await supabaseServer()

  const { error } = await supabase.from('okulsuz_gunler').insert({
    tarih,
    hizmet_noktasi_id: hizmetNoktasiId,
    sebep: sebep?.trim() || null,
  })

  // Aynı gün iki kez işaretlenirse benzersiz indeks engeller; kullanıcı
  // açısından sonuç zaten istediği durum olduğu için hata gösterilmez.
  if (error && error.code !== '23505') return { hata: error.message }

  tazele()
  return { basari: 'Gün okulsuz olarak işaretlendi.' }
}

/**
 * İşareti kaldırır: gün yeniden normal iş günü sayılır.
 *
 * `acilacakYerler` verilir ve kayıt genel ise (resmi tatil) yalnız o yerler
 * açılır; öbür yerler kapalı kalır. Önce genel kayıt doğrudan siliniyordu:
 * tek bir yerde geri alınan tatil her yerde açılıyordu.
 */
export async function okulYokKaldir(
  id: string,
  acilacakYerler?: string[],
): Promise<OkulsuzDurumu> {
  const supabase = await supabaseServer()

  const { data: kayit } = await supabase
    .from('okulsuz_gunler')
    .select('id, tarih, hizmet_noktasi_id, sebep')
    .eq('id', id)
    .maybeSingle()
  if (!kayit) return { hata: 'Kayıt bulunamadı; sayfayı yenileyin.' }

  if (kayit.hizmet_noktasi_id === null && acilacakYerler) {
    const hata = await genelKaydiBol(supabase, kayit as OkulsuzGun, acilacakYerler)
    if (hata) return { hata }
  } else {
    const { error } = await supabase.from('okulsuz_gunler').delete().eq('id', id)
    if (error) return { hata: error.message }
  }

  tazele()
  return { basari: 'Gün yeniden açıldı.' }
}

/**
 * Genel kaydı, açılacak yerler dışındaki her yer için yere özel kayda çevirir.
 * Önce yeni kayıtlar yazılır, sonra genel kayıt silinir: arada hiçbir yer
 * yanlışlıkla açık görünmez.
 */
async function genelKaydiBol(
  supabase: Istemci,
  genel: OkulsuzGun,
  acilacakYerler: string[],
): Promise<string | null> {
  const { data: tumYerler } = await supabase.from('hizmet_noktalari').select('id')
  const acilacak = new Set(acilacakYerler)
  const kalanlar = ((tumYerler ?? []) as { id: string }[])
    .map((y) => y.id)
    .filter((y) => !acilacak.has(y))

  const hata = await yerlereKapat(supabase, genel.tarih, kalanlar, genel.sebep)
  if (hata) return hata

  const { error } = await supabase.from('okulsuz_gunler').delete().eq('id', genel.id)
  return error ? error.message : null
}

/** Verilen yerlerde günü kapatır; zaten kapalı olan yerlere dokunmaz. */
async function yerlereKapat(
  supabase: Istemci,
  tarih: string,
  yerler: string[],
  sebep: string | null,
): Promise<string | null> {
  if (yerler.length === 0) return null
  const { data: mevcut } = await supabase
    .from('okulsuz_gunler')
    .select('hizmet_noktasi_id')
    .eq('tarih', tarih)
    .in('hizmet_noktasi_id', yerler)
  const kapali = new Set(
    ((mevcut ?? []) as { hizmet_noktasi_id: string }[]).map((m) => m.hizmet_noktasi_id),
  )
  const yeni = yerler
    .filter((y) => !kapali.has(y))
    .map((y) => ({ tarih, hizmet_noktasi_id: y, sebep: sebep?.trim() || null }))
  if (yeni.length === 0) return null

  const { error } = await supabase.from('okulsuz_gunler').insert(yeni)
  return error && error.code !== '23505' ? error.message : null
}

async function listeYerleri(supabase: Istemci, listeId: string) {
  const { data } = await supabase.from('hizmet_noktalari').select('id').eq('liste_id', listeId)
  return ((data ?? []) as { id: string }[]).map((y) => y.id)
}

const LISTESIZ =
  'Bu menüyü yiyen hizmet yeri yok. Önce Maliyet → Hizmet Yerleri’nden menüyü bir yere bağlayın.'

/**
 * Menü ekranından: günü yalnız bu menüyü yiyen yerlerde kapatır. Diğer
 * menüler ve okullar etkilenmez.
 */
export async function menuGunuKapat(
  listeId: string,
  tarih: string,
  sebep: string | null,
): Promise<OkulsuzDurumu> {
  const supabase = await supabaseServer()
  const yerler = await listeYerleri(supabase, listeId)
  if (yerler.length === 0) return { hata: LISTESIZ }

  const hata = await yerlereKapat(supabase, tarih, yerler, sebep)
  if (hata) return { hata }

  tazele()
  return { basari: 'Gün bu menüyü yiyen yerlerde kapatıldı.' }
}

/**
 * Menü ekranından: günü yalnız bu menüyü yiyen yerlerde açar. Gün resmi
 * tatilse (genel kayıt) tatil diğer yerlerde sürer.
 */
export async function menuGunuAc(listeId: string, tarih: string): Promise<OkulsuzDurumu> {
  const supabase = await supabaseServer()
  const yerler = await listeYerleri(supabase, listeId)
  if (yerler.length === 0) return { hata: LISTESIZ }

  const { error } = await supabase
    .from('okulsuz_gunler')
    .delete()
    .eq('tarih', tarih)
    .in('hizmet_noktasi_id', yerler)
  if (error) return { hata: error.message }

  const { data: genel } = await supabase
    .from('okulsuz_gunler')
    .select('id, tarih, hizmet_noktasi_id, sebep')
    .eq('tarih', tarih)
    .is('hizmet_noktasi_id', null)
    .maybeSingle()
  if (genel) {
    const hata = await genelKaydiBol(supabase, genel as OkulsuzGun, yerler)
    if (hata) return { hata }
  }

  tazele()
  return { basari: 'Gün bu menüyü yiyen yerlerde yeniden açıldı.' }
}
