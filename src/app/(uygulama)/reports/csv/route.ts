import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { GelenGidenSatiri } from '@/lib/types'

/** Excel'in Türkçe yerelinde doğru açılması için ; ayracı ve virgüllü ondalık. */
function hucre(deger: string | number | null): string {
  const metin = String(deger ?? '')
  return `"${metin.replace(/"/g, '""')}"`
}

function sayi(deger: number | string): string {
  return `"${Number(deger).toFixed(2).replace('.', ',')}"`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const bas = url.searchParams.get('bas')
  const bit = url.searchParams.get('bit')
  const sinif = url.searchParams.get('sinif')

  if (!bas || !bit) {
    return new Response('bas ve bit parametreleri gerekli.', { status: 400 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Yetkisiz.', { status: 401 })

  const okul = await aktifOkul()
  if (!okul) return new Response('Okul seçili değil.', { status: 400 })

  const { data, error } = await supabase.rpc('gelen_giden_raporu', {
    p_okul_id: okul.id,
    p_bas: bas,
    p_bit: bit,
  })
  if (error) return new Response(error.message, { status: 500 })

  let satirlar = (data ?? []) as GelenGidenSatiri[]
  if (sinif) satirlar = satirlar.filter((s) => s.sinif === sinif)

  const basliklar = [
    'Öğrenci No',
    'Ad Soyad',
    'Sınıf',
    'Abone Tipi',
    'Devir',
    'Dönem Tahsilat',
    'Dönem Harcama',
    'Öğün Sayısı',
    'Güncel Kalan',
  ]

  const govde = satirlar.map((s) =>
    [
      hucre(s.ogrenci_no),
      hucre(s.ad_soyad),
      hucre(s.sinif),
      hucre(s.abone_tipi === 'aylik' ? 'Aylıkçı' : 'Günlükçü'),
      sayi(s.devir),
      sayi(s.donem_tahsilat),
      sayi(s.donem_harcama),
      hucre(s.donem_ogun),
      sayi(s.guncel_kalan),
    ].join(';'),
  )

  const toplam = satirlar.reduce(
    (t, s) => ({
      devir: t.devir + Number(s.devir),
      tahsilat: t.tahsilat + Number(s.donem_tahsilat),
      harcama: t.harcama + Number(s.donem_harcama),
      ogun: t.ogun + Number(s.donem_ogun),
      kalan: t.kalan + Number(s.guncel_kalan),
    }),
    { devir: 0, tahsilat: 0, harcama: 0, ogun: 0, kalan: 0 },
  )

  const toplamSatiri = [
    hucre(''),
    hucre('TOPLAM'),
    hucre(''),
    hucre(''),
    sayi(toplam.devir),
    sayi(toplam.tahsilat),
    sayi(toplam.harcama),
    hucre(toplam.ogun),
    sayi(toplam.kalan),
  ].join(';')

  // BOM: Excel'in UTF-8'i doğru tanıması için
  const csv = '﻿' + [basliklar.map(hucre).join(';'), ...govde, toplamSatiri].join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gelen-giden-${okul.ad.replace(/[^\p{L}\p{N}]+/gu, '-')}-${bas}_${bit}.csv"`,
    },
  })
}
