import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import { DONEMLER } from '../kiralar/donemler'
import { GIDER_ADLARI, type GiderTuru } from '../kiralar/gider-turleri'

import { OdemePlaniEkrani, type Kalem } from './OdemePlaniEkrani'

export const metadata = { title: 'Ödeme Takvimi — Yemek Takip' }

/** Pazartesiden başlayan haftanın ilk günü */
function haftaBasi(tarih: string): string {
  const d = new Date(`${tarih}T00:00:00`)
  const gun = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (gun - 1))
  return gunMetni(d)
}

function gunMetni(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function gunEkle(tarih: string, gun: number): string {
  const d = new Date(`${tarih}T00:00:00`)
  d.setDate(d.getDate() + gun)
  return gunMetni(d)
}

/** Ayın kaçıncı günü varsa o tarihi verir; ay kısaysa ayın son günü */
function ayinGunu(yil: number, ay: number, gun: number): string {
  const sonGun = new Date(yil, ay, 0).getDate()
  return `${yil}-${String(ay).padStart(2, '0')}-${String(Math.min(gun, sonGun)).padStart(2, '0')}`
}

/**
 * Haftalık ödeme takvimi.
 *
 * Maaş, senet, SGK ve faturaların vadeleri tek yerde toplanıyor: o hafta
 * kime ne ödeneceği tek bakışta görünsün. Kalemler kendi ekranlarından
 * geliyor, burada yalnızca vadesi hesaplanıp sıralanıyor; elle eklenenler
 * `odeme_plani` tablosunda duruyor.
 *
 * Vadesi geçmiş ve hâlâ ödenmemiş kalemler haftadan bağımsız olarak ayrıca
 * gösteriliyor — hafta değiştirince gözden kaçmasınlar.
 */
export default async function OdemePlaniPage({
  searchParams,
}: {
  searchParams: Promise<{ hafta?: string }>
}) {
  const q = await searchParams
  const bugun = await bugunSunucu()
  const bas = haftaBasi(/^\d{4}-\d{2}-\d{2}$/.test(q.hafta ?? '') ? q.hafta! : bugun)
  const bit = gunEkle(bas, 6)

  const supabase = await supabaseServer()

  const [
    { data: personelVeri },
    { data: maasVeri },
    { data: senetVeri },
    { data: sgkVeri },
    { data: faturaVeri },
    { data: abonelikVeri },
    { data: planVeri },
  ] = await Promise.all([
    supabase.from('personeller').select('id, ad, maas_gunu, calistigi_yer').eq('aktif', true),
    supabase.from('maas_odemeleri').select('personel_id, donem_yil, donem_ay'),
    supabase.from('senetler').select('id, vade_tarihi, kime, tutar, banka, senet_no, odeme_tarihi'),
    supabase.from('donemsel_giderler').select('id, tur, donem_yil, donem_ay, tutar, odeme_tarihi'),
    supabase
      .from('fatura_odemeleri')
      .select('yer, gider_turu, donem, tutar, odendi')
      .eq('odendi', false),
    supabase.from('fatura_abonelikleri').select('yer, gider_turu, vade_gunu, sozlesme_no'),
    supabase.from('odeme_plani').select('id, vade_tarihi, kime, tutar, aciklama, odendi'),
  ])

  const kalemler: Kalem[] = []

  // --- Maaşlar: personelin maaş günü, bu haftanın içine düşen aylar için
  const odenmis = new Set(
    ((maasVeri ?? []) as { personel_id: string; donem_yil: number; donem_ay: number }[]).map(
      (m) => `${m.personel_id}|${m.donem_yil}|${m.donem_ay}`,
    ),
  )
  const aylar = new Set([bas.slice(0, 7), bit.slice(0, 7)])
  for (const p of (personelVeri ?? []) as {
    id: string
    ad: string
    maas_gunu: number | null
    calistigi_yer: string | null
  }[]) {
    if (!p.maas_gunu) continue
    for (const ayMetni of aylar) {
      const [yil, ay] = ayMetni.split('-').map(Number)
      const vade = ayinGunu(yil, ay, p.maas_gunu)
      if (odenmis.has(`${p.id}|${yil}|${ay}`)) continue
      kalemler.push({
        id: `maas-${p.id}-${ayMetni}`,
        tur: 'Maaş',
        vade,
        kime: p.ad,
        tutar: null,
        not: p.calistigi_yer ?? null,
        yol: '/finans/maaslar',
      })
    }
  }

  // --- Senetler: vadesi girilmiş, ödeme tarihi boş olanlar
  for (const s of (senetVeri ?? []) as {
    id: string
    vade_tarihi: string
    kime: string
    tutar: number | string
    banka: string | null
    senet_no: string | null
    odeme_tarihi: string | null
  }[]) {
    if (s.odeme_tarihi) continue
    kalemler.push({
      id: `senet-${s.id}`,
      tur: 'Senet',
      vade: s.vade_tarihi,
      kime: s.kime,
      tutar: Number(s.tutar),
      not: [s.banka, s.senet_no].filter(Boolean).join(' · ') || null,
      yol: '/finans',
    })
  }

  // --- SGK: dönemi takip eden ayın son günü ödenir
  for (const g of (sgkVeri ?? []) as {
    id: string
    tur: string
    donem_yil: number
    donem_ay: number
    tutar: number | string
    odeme_tarihi: string | null
  }[]) {
    if (g.odeme_tarihi) continue
    const yil = g.donem_ay === 12 ? g.donem_yil + 1 : g.donem_yil
    const ay = g.donem_ay === 12 ? 1 : g.donem_ay + 1
    kalemler.push({
      id: `sgk-${g.id}`,
      tur: 'SGK',
      vade: ayinGunu(yil, ay, 31),
      kime: g.tur,
      tutar: Number(g.tutar),
      not: `${String(g.donem_ay).padStart(2, '0')}.${g.donem_yil} dönemi`,
      yol: '/finans/arti-eksi',
    })
  }

  // --- Faturalar: aboneliğin vade günü, faturanın kendi dönemi içinde
  const vadeGunu = new Map(
    ((abonelikVeri ?? []) as {
      yer: string
      gider_turu: string
      vade_gunu: number | null
      sozlesme_no: string | null
    }[]).map((a) => [`${a.yer}|${a.gider_turu}`, a]),
  )
  for (const f of (faturaVeri ?? []) as {
    yer: string
    gider_turu: GiderTuru
    donem: string
    tutar: number | string
  }[]) {
    if (!DONEMLER.includes(f.donem)) continue
    const a = vadeGunu.get(`${f.yer}|${f.gider_turu}`)
    if (!a?.vade_gunu) continue
    const [yil, ay] = f.donem.split('-').map(Number)
    kalemler.push({
      id: `fatura-${f.yer}-${f.gider_turu}-${f.donem}`,
      tur: GIDER_ADLARI[f.gider_turu],
      vade: ayinGunu(yil, ay, a.vade_gunu),
      kime: f.yer,
      tutar: Number(f.tutar) || null,
      not: a.sozlesme_no ? `Söz. ${a.sozlesme_no}` : null,
      yol: '/finans/kiralar?sekme=faturalar',
    })
  }

  // --- Elle eklenenler
  for (const p of (planVeri ?? []) as {
    id: string
    vade_tarihi: string
    kime: string
    tutar: number | string
    aciklama: string | null
    odendi: boolean
  }[]) {
    if (p.odendi) continue
    kalemler.push({
      id: `plan-${p.id}`,
      planId: p.id,
      tur: 'Elle',
      vade: p.vade_tarihi,
      kime: p.kime,
      tutar: Number(p.tutar),
      not: p.aciklama,
    })
  }

  kalemler.sort((a, b) => a.vade.localeCompare(b.vade) || a.kime.localeCompare(b.kime))

  return (
    <OdemePlaniEkrani
      kalemler={kalemler}
      bas={bas}
      bit={bit}
      bugun={bugun}
      oncekiHafta={gunEkle(bas, -7)}
      sonrakiHafta={gunEkle(bas, 7)}
    />
  )
}
