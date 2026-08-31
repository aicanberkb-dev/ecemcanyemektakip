'use server'

import { revalidatePath } from 'next/cache'

import { supabaseServer } from '@/lib/supabase/server'

export type MenuDurumu = { hata?: string; basari?: string }

export type MenuGunGirdisi = {
  tarih: string
  corba: string | null
  ana_yemek: string | null
  yardimci: string | null
  ek: string | null
}

/**
 * Bir listenin ayını topluca kaydeder.
 *
 * Dört alanı da boş olan gün kaydedilmez, varsa silinir: ekranda temizlenen
 * bir gün veritabanında kalmasın. Silme işlemi de bu yolla yapılır.
 */
export async function menuKaydet(
  listeId: string,
  gunler: MenuGunGirdisi[],
): Promise<MenuDurumu> {
  const supabase = await supabaseServer()

  const { data: liste } = await supabase
    .from('menu_listeleri')
    .select('id, okul_id')
    .eq('id', listeId)
    .maybeSingle()

  if (!liste) return { hata: 'Liste bulunamadı.' }

  const temizle = (d: string | null) => {
    const t = (d ?? '').trim()
    return t === '' ? null : t.toLocaleUpperCase('tr')
  }

  const dolu = []
  const bos: string[] = []

  for (const g of gunler) {
    const satir = {
      liste_id: listeId,
      okul_id: liste.okul_id,
      tarih: g.tarih,
      corba: temizle(g.corba),
      ana_yemek: temizle(g.ana_yemek),
      yardimci: temizle(g.yardimci),
      ek: temizle(g.ek),
    }
    if (satir.corba || satir.ana_yemek || satir.yardimci || satir.ek) dolu.push(satir)
    else bos.push(g.tarih)
  }

  if (dolu.length > 0) {
    const { error } = await supabase
      .from('menu_gunleri')
      .upsert(dolu, { onConflict: 'liste_id,tarih' })
    if (error) return { hata: error.message }
  }

  if (bos.length > 0) {
    const { error } = await supabase
      .from('menu_gunleri')
      .delete()
      .eq('liste_id', listeId)
      .in('tarih', bos)
    if (error) return { hata: error.message }
  }

  revalidatePath('/menu')
  revalidatePath('/reports/gun-sonu')
  return {
    basari:
      `${dolu.length} gün kaydedildi` +
      (bos.length > 0 ? ` · ${bos.length} gün temizlendi.` : '.'),
  }
}

/**
 * Bir listenin bir ayını başka bir listeye/aya kopyalar.
 *
 * GÖKSU ile AHMET MİTHAT menüleri neredeyse aynı; sıfırdan yazmak yerine
 * kopyalayıp farkları düzeltmek çok daha hızlı. Hafta içi günler sırayla
 * eşlenir, hafta sonları atlanır.
 */
export async function menuKopyala(
  kaynakListeId: string,
  kaynakYil: number,
  kaynakAy: number,
  hedefListeId: string,
  hedefYil: number,
  hedefAy: number,
): Promise<MenuDurumu> {
  const supabase = await supabaseServer()

  const { data: hedefListe } = await supabase
    .from('menu_listeleri')
    .select('id, okul_id')
    .eq('id', hedefListeId)
    .maybeSingle()
  if (!hedefListe) return { hata: 'Hedef liste bulunamadı.' }

  const ayAralik = (y: number, a: number) => ({
    bas: `${y}-${String(a).padStart(2, '0')}-01`,
    bit: `${y}-${String(a).padStart(2, '0')}-${new Date(y, a, 0).getDate()}`,
  })

  const k = ayAralik(kaynakYil, kaynakAy)
  const { data, error } = await supabase
    .from('menu_gunleri')
    .select('tarih, corba, ana_yemek, yardimci, ek')
    .eq('liste_id', kaynakListeId)
    .gte('tarih', k.bas)
    .lte('tarih', k.bit)
    .order('tarih')

  if (error) return { hata: error.message }
  const kaynak = data ?? []
  if (kaynak.length === 0) return { hata: 'Kaynak ayda menü yok.' }

  const iki = (n: number) => String(n).padStart(2, '0')
  const gunSayisi = new Date(hedefYil, hedefAy, 0).getDate()

  // Tatil gününe menü yazma: sömestrin ortasına yemek listesi düşmesin
  const { data: tatilVeri } = await supabase
    .from('okulsuz_gunler')
    .select('tarih')
    .is('hizmet_noktasi_id', null)
    .gte('tarih', `${hedefYil}-${iki(hedefAy)}-01`)
    .lte('tarih', `${hedefYil}-${iki(hedefAy)}-${gunSayisi}`)

  const tatiller = new Set(((tatilVeri ?? []) as { tarih: string }[]).map((t) => t.tarih))

  const hedefGunler: string[] = []
  for (let g = 1; g <= gunSayisi; g++) {
    const h = new Date(hedefYil, hedefAy - 1, g).getDay()
    const tarih = `${hedefYil}-${iki(hedefAy)}-${iki(g)}`
    if (h !== 0 && h !== 6 && !tatiller.has(tarih)) hedefGunler.push(tarih)
  }

  const satirlar = hedefGunler.slice(0, kaynak.length).map((tarih, i) => ({
    liste_id: hedefListeId,
    okul_id: hedefListe.okul_id,
    tarih,
    corba: kaynak[i].corba,
    ana_yemek: kaynak[i].ana_yemek,
    yardimci: kaynak[i].yardimci,
    ek: kaynak[i].ek,
  }))

  const { error: yazmaHatasi } = await supabase
    .from('menu_gunleri')
    .upsert(satirlar, { onConflict: 'liste_id,tarih' })
  if (yazmaHatasi) return { hata: yazmaHatasi.message }

  revalidatePath('/menu')
  return {
    basari:
      `${satirlar.length} gün kopyalandı. Üzerinde düzenleme yapabilirsiniz.` +
      (tatiller.size > 0 ? ` ${tatiller.size} tatil günü atlandı.` : ''),
  }
}
