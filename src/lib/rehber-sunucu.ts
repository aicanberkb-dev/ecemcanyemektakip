import { okullar as okullariGetir } from '@/lib/okul'
import { rehberKisileri, type RehberKisisi, type VeliKisi } from '@/lib/rehber'
import { supabaseServer } from '@/lib/supabase/server'

type Satir = {
  ad_soyad: string
  okul_id: string
  veli_adi: string | null
  veli_telefon: string | null
  veli2_adi: string | null
  veli2_telefon: string | null
}

/**
 * Velilerin rehber kartları.
 *
 * `hepsiOkul` verilirse bütün okullar tek listede döner; aksi hâlde yalnızca
 * verilen okul.
 */
export async function rehberListesi(
  hepsiOkul: boolean,
  okulId?: string,
): Promise<RehberKisisi[]> {
  const supabase = await supabaseServer()

  let sorgu = supabase
    .from('students')
    .select('ad_soyad, okul_id, veli_adi, veli_telefon, veli2_adi, veli2_telefon')
    .eq('aktif', true)
    .order('ad_soyad')

  if (!hepsiOkul && okulId) sorgu = sorgu.eq('okul_id', okulId)

  const { data, error } = await sorgu
  if (error) throw new Error(error.message)

  const okulAdlari = new Map((await okullariGetir()).map((o) => [o.id, o.ad]))
  const satirlar = (data ?? []) as Satir[]

  // Her velinin numarası ayrı bir kişi: ödemeyi anne de baba da yapabiliyor
  // ve ikisine de mesaj gidebilmeli.
  const kayitlar: VeliKisi[] = satirlar.flatMap((s) => {
    const okulAdi = okulAdlari.get(s.okul_id) ?? ''
    return [
      { ogrenciAdi: s.ad_soyad, veliAdi: s.veli_adi, telefon: s.veli_telefon, okulAdi },
      {
        ogrenciAdi: s.ad_soyad,
        veliAdi: s.veli2_adi ?? s.veli_adi,
        telefon: s.veli2_telefon,
        okulAdi,
      },
    ]
  })

  return rehberKisileri(kayitlar)
}

/**
 * Daha önce aktarılmamış ya da adı değişmiş kişiler.
 *
 * Numara rehberde kişiyi tekilleştiren şey; daha önce verilmiş bir numarayı
 * tekrar vermek telefonda mükerrer kart oluşturuyor. Ad değiştiyse (veli adı
 * düzeltildi, kardeş eklendi) kart yeniden veriliyor — telefon aynı numarayı
 * gördüğü için üzerine yazıyor, kopya oluşmuyor.
 */
export async function bekleyenler(
  kisiler: RehberKisisi[],
): Promise<{ yeni: RehberKisisi[]; degisen: RehberKisisi[] }> {
  const supabase = await supabaseServer()
  const { data } = await supabase.from('rehber_kayitlari').select('telefon, ad')

  const onceki = new Map(
    ((data ?? []) as { telefon: string; ad: string }[]).map((r) => [r.telefon, r.ad]),
  )

  const yeni: RehberKisisi[] = []
  const degisen: RehberKisisi[] = []
  for (const k of kisiler) {
    const eski = onceki.get(k.telefon)
    if (eski === undefined) yeni.push(k)
    else if (eski !== k.ad) degisen.push(k)
  }
  return { yeni, degisen }
}

/** Verilen kartlar işaretlenir; sonraki indirmede tekrar gelmesinler. */
export async function aktarildiIsaretle(
  kisiler: RehberKisisi[],
  okulId: string | null,
): Promise<void> {
  if (kisiler.length === 0) return
  const supabase = await supabaseServer()
  const simdi = new Date().toISOString()

  await supabase.from('rehber_kayitlari').upsert(
    kisiler.map((k) => ({
      telefon: k.telefon,
      ad: k.ad,
      okul_id: okulId,
      son_aktarim: simdi,
    })),
    { onConflict: 'telefon' },
  )
}
