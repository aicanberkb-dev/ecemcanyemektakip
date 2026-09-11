import type { OkulsuzGun } from '@/app/(uygulama)/okulsuz-actions'
import type { supabaseServer } from '@/lib/supabase/server'

type Istemci = Awaited<ReturnType<typeof supabaseServer>>

/**
 * Kapalı günler iki türlü tutulur: genel kayıt (hizmet_noktasi_id boş — resmi
 * tatil, her yerde kapalı) ya da tek bir hizmet yerine konmuş kayıt (gezi, o
 * okulun ilk günü…). Ekranlar hangi yerlere baktıklarına göre ikisini birlikte
 * okur; önce yalnız genel kayda bakılıyordu ve bir okulun kapalı günü öbür
 * okulu da kapatmak zorundaydı.
 */

async function yerKimlikleri(supabase: Istemci, alan: 'liste_id' | 'okul_id', deger: string) {
  const { data } = await supabase.from('hizmet_noktalari').select('id').eq(alan, deger)
  return ((data ?? []) as { id: string }[]).map((n) => n.id)
}

async function kayitlar(supabase: Istemci, yerler: string[], bas: string, bit: string) {
  let sorgu = supabase
    .from('okulsuz_gunler')
    .select('id, tarih, hizmet_noktasi_id, sebep')
    .gte('tarih', bas)
    .lte('tarih', bit)
  sorgu =
    yerler.length > 0
      ? sorgu.or(`hizmet_noktasi_id.is.null,hizmet_noktasi_id.in.(${yerler.join(',')})`)
      : sorgu.is('hizmet_noktasi_id', null)
  const { data } = await sorgu
  return (data ?? []) as OkulsuzGun[]
}

function tariheGore(satirlar: OkulsuzGun[]) {
  const m = new Map<string, OkulsuzGun[]>()
  for (const s of satirlar) m.set(s.tarih, [...(m.get(s.tarih) ?? []), s])
  return m
}

/**
 * Bir menü listesinin kapalı günleri: genel tatil ya da listeyi yiyen bütün
 * yerlerde kapalı gün. Liste birkaç yerde ortaksa yalnız birinde kapalı olan
 * gün (o yerin gezisi) menüde açık kalır. Gün başına tek kayıt döner; genel
 * kayıt varsa o.
 */
export async function listeKapaliGunleri(
  supabase: Istemci,
  listeId: string,
  bas: string,
  bit: string,
): Promise<OkulsuzGun[]> {
  const yerler = await yerKimlikleri(supabase, 'liste_id', listeId)
  const sonuc: OkulsuzGun[] = []
  for (const grup of tariheGore(await kayitlar(supabase, yerler, bas, bit)).values()) {
    const genel = grup.find((s) => s.hizmet_noktasi_id === null)
    if (genel) {
      sonuc.push(genel)
      continue
    }
    const kapali = new Set(grup.map((s) => s.hizmet_noktasi_id))
    if (yerler.length > 0 && yerler.every((y) => kapali.has(y))) sonuc.push(grup[0])
  }
  return sonuc.sort((a, b) => a.tarih.localeCompare(b.tarih))
}

/**
 * Bir okulun kapalı günleri: genel tatil ya da okulun kendi hizmet yerine
 * konmuş kapalı gün. Gün başına tek kayıt; genel kayıt varsa o.
 */
export async function okulKapaliGunleri(
  supabase: Istemci,
  okulId: string,
  bas: string,
  bit: string,
): Promise<OkulsuzGun[]> {
  const yerler = await yerKimlikleri(supabase, 'okul_id', okulId)
  const sonuc: OkulsuzGun[] = []
  for (const grup of tariheGore(await kayitlar(supabase, yerler, bas, bit)).values()) {
    sonuc.push(grup.find((s) => s.hizmet_noktasi_id === null) ?? grup[0])
  }
  return sonuc.sort((a, b) => a.tarih.localeCompare(b.tarih))
}
