'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { aktifOkulId } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import { bosNull, trSayi } from '@/lib/zod-tr'

export type TaksitIstisnaDurumu = {
  hata?: string
  basari?: string
  alanlar?: Record<string, string>
}

/** Öğrencinin aktif okula ait olduğunu doğrular. */
async function ogrenciOkuldaMi(studentId: string): Promise<boolean> {
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('okul_id', await aktifOkulId())
    .maybeSingle()
  return !!data
}

/**
 * Bir taksit satırını bu öğrenciye özel hale getirir.
 * Okul planındaki değerle aynı gönderilen alan istisna sayılmaz (null bırakılır),
 * böylece o alan okul planını izlemeye devam eder.
 */
export async function ogrenciTaksitGuncelle(
  studentId: string,
  taksitPlaniId: string,
  _onceki: TaksitIstisnaDurumu,
  formData: FormData,
): Promise<TaksitIstisnaDurumu> {
  const sema = z.object({
    tutar: trSayi({ min: 0 }),
    vade_tarihi: z.string().min(1, 'Vade tarihi gerekli.'),
    aciklama: bosNull,
  })

  const sonuc = sema.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  if (!(await ogrenciOkuldaMi(studentId))) {
    return { hata: 'Öğrenci seçili okulda bulunamadı.' }
  }

  const supabase = await supabaseServer()

  const { data: plan } = await supabase
    .from('taksit_plani')
    .select('tutar, vade_tarihi, sezon_id')
    .eq('id', taksitPlaniId)
    .maybeSingle()

  if (!plan) return { hata: 'Taksit bulunamadı.' }

  const tutarFarkli = Number(sonuc.data.tutar) !== Number(plan.tutar)
  const vadeFarkli = sonuc.data.vade_tarihi !== plan.vade_tarihi

  // İkisi de okul planıyla aynıysa istisna kaydına gerek yok
  if (!tutarFarkli && !vadeFarkli) {
    await supabase
      .from('ogrenci_taksit')
      .delete()
      .eq('student_id', studentId)
      .eq('taksit_plani_id', taksitPlaniId)

    revalidatePath(`/students/${studentId}`)
    revalidatePath('/reports/taksit')
    return { basari: 'Okul planına döndürüldü.' }
  }

  const { error } = await supabase.from('ogrenci_taksit').upsert(
    {
      student_id: studentId,
      taksit_plani_id: taksitPlaniId,
      sezon_id: plan.sezon_id,
      tutar: tutarFarkli ? sonuc.data.tutar : null,
      vade_tarihi: vadeFarkli ? sonuc.data.vade_tarihi : null,
      aciklama: sonuc.data.aciklama,
    },
    { onConflict: 'student_id,taksit_plani_id' },
  )

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
  return { basari: 'Bu öğrenciye özel kaydedildi.' }
}

/** İstisnayı kaldırır; satır yeniden okul planını izler. */
export async function ogrenciTaksitVarsayilana(studentId: string, taksitPlaniId: string) {
  if (!(await ogrenciOkuldaMi(studentId))) {
    throw new Error('Öğrenci seçili okulda bulunamadı.')
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('ogrenci_taksit')
    .delete()
    .eq('student_id', studentId)
    .eq('taksit_plani_id', taksitPlaniId)

  if (error) throw new Error(error.message)

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
}

const ekstraSemasi = z.object({
  ad: z.string().trim().min(1, 'Taksit adı gerekli.'),
  tutar: trSayi({ min: 0 }),
  vade_tarihi: z.string().min(1, 'Vade tarihi gerekli.'),
  aciklama: bosNull,
})

function alanHatalari(hata: z.ZodError): Record<string, string> {
  const sonuc: Record<string, string> = {}
  for (const s of hata.issues) {
    const alan = String(s.path[0] ?? '')
    if (alan && !sonuc[alan]) sonuc[alan] = s.message
  }
  return sonuc
}

/**
 * Okul planında karşılığı olmayan, yalnızca bu öğrenciye ait taksit ekler.
 * Okul 3 taksitse veliyle 6 taksitte anlaşılmış olabilir.
 */
export async function ogrenciTaksitEkstraEkle(
  studentId: string,
  sezonId: string,
  _onceki: TaksitIstisnaDurumu,
  formData: FormData,
): Promise<TaksitIstisnaDurumu> {
  const sonuc = ekstraSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  if (!(await ogrenciOkuldaMi(studentId))) {
    return { hata: 'Öğrenci seçili okulda bulunamadı.' }
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.from('ogrenci_taksit').insert({
    student_id: studentId,
    taksit_plani_id: null,
    sezon_id: sezonId,
    ...sonuc.data,
  })

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
  return { basari: 'Taksit eklendi.' }
}

export async function ogrenciTaksitEkstraGuncelle(
  studentId: string,
  istisnaId: string,
  _onceki: TaksitIstisnaDurumu,
  formData: FormData,
): Promise<TaksitIstisnaDurumu> {
  const sonuc = ekstraSemasi.safeParse(Object.fromEntries(formData.entries()))
  if (!sonuc.success) return { alanlar: alanHatalari(sonuc.error) }

  if (!(await ogrenciOkuldaMi(studentId))) {
    return { hata: 'Öğrenci seçili okulda bulunamadı.' }
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('ogrenci_taksit')
    .update(sonuc.data)
    .eq('id', istisnaId)
    .eq('student_id', studentId)

  if (error) return { hata: error.message }

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
  return { basari: 'Taksit güncellendi.' }
}

export async function ogrenciTaksitEkstraSil(studentId: string, istisnaId: string) {
  if (!(await ogrenciOkuldaMi(studentId))) {
    throw new Error('Öğrenci seçili okulda bulunamadı.')
  }

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from('ogrenci_taksit')
    .delete()
    .eq('id', istisnaId)
    .eq('student_id', studentId)

  if (error) throw new Error(error.message)

  revalidatePath(`/students/${studentId}`)
  revalidatePath('/reports/taksit')
}

/**
 * Bir öğrencinin taksit planını başka bir öğrenciye aynen kopyalar.
 *
 * Veliyle yapılan anlaşma çoğu zaman tek tek aynı: kardeşe ya da benzer
 * durumdaki öğrenciye aynı plan elle giriliyordu. Kopyada kaynağın gördüğü
 * tutar ve vadeler hedefe yazılır; hedefin kendi okul planı satırları varsa
 * onlar istisnaya çevrilir, fazlası ek taksit olarak eklenir.
 *
 * Hedefin eski özel satırları silinir: "aynen aktar" denildiğinde ikisinin
 * karışımı değil, kaynağın planı kalmalı.
 */
export async function taksitPlaniKopyala(
  hedefId: string,
  sezonId: string,
  kaynakId: string,
): Promise<TaksitIstisnaDurumu> {
  if (hedefId === kaynakId) return { hata: 'Kaynak ve hedef aynı öğrenci.' }
  if (!(await ogrenciOkuldaMi(hedefId)) || !(await ogrenciOkuldaMi(kaynakId))) {
    return { hata: 'Öğrenci seçili okulda bulunamadı.' }
  }

  const supabase = await supabaseServer()

  // Kaynağın gördüğü plan (okul planı + ona özel satırlar)
  const { data: kaynakVeri, error: kaynakHata } = await supabase.rpc('ogrenci_taksit_plani', {
    p_student_id: kaynakId,
    p_sezon_id: sezonId,
  })
  if (kaynakHata) return { hata: kaynakHata.message }

  const kaynak = ((kaynakVeri ?? []) as { tutar: number; vade_tarihi: string }[])
    .map((s) => ({ tutar: Number(s.tutar), vade_tarihi: s.vade_tarihi }))
    .sort((a, b) => a.vade_tarihi.localeCompare(b.vade_tarihi))

  if (kaynak.length === 0) return { hata: 'Kaynak öğrencinin bu sezonda taksiti yok.' }

  // Hedefin kendi tipinin okul planı: satırlar sırayla eşleştirilir
  const { data: hedefPlanVeri, error: planHata } = await supabase.rpc('ogrenci_taksit_plani', {
    p_student_id: hedefId,
    p_sezon_id: sezonId,
  })
  if (planHata) return { hata: planHata.message }

  const hedefPlan = ((hedefPlanVeri ?? []) as { taksit_plani_id: string | null }[])
    .filter((s) => s.taksit_plani_id)
    .map((s) => s.taksit_plani_id as string)

  // Hedefin eski özel satırları temizlenir
  const { error: silHata } = await supabase
    .from('ogrenci_taksit')
    .delete()
    .eq('student_id', hedefId)
    .eq('sezon_id', sezonId)
  if (silHata) return { hata: silHata.message }

  const satirlar = kaynak.map((s, i) => ({
    student_id: hedefId,
    sezon_id: sezonId,
    taksit_plani_id: hedefPlan[i] ?? null,
    ad: hedefPlan[i] ? null : `${i + 1}. Taksit`,
    tutar: s.tutar,
    vade_tarihi: s.vade_tarihi,
    aciklama: 'Başka öğrenciden kopyalandı',
  }))

  // Hedefin planında kaynaktan fazla satır varsa onlar sıfırlanır; yoksa
  // kopyalanan planın üstüne okul planından artık taksitler eklenirdi.
  for (const planId of hedefPlan.slice(kaynak.length)) {
    satirlar.push({
      student_id: hedefId,
      sezon_id: sezonId,
      taksit_plani_id: planId,
      ad: null,
      tutar: 0,
      vade_tarihi: kaynak[kaynak.length - 1].vade_tarihi,
      aciklama: 'Kopyalanan planda yok',
    })
  }

  const { error } = await supabase.from('ogrenci_taksit').insert(satirlar)
  if (error) return { hata: error.message }

  revalidatePath(`/students/${hedefId}`)
  revalidatePath('/reports/taksit')
  return { basari: `${kaynak.length} taksit kopyalandı.` }
}
