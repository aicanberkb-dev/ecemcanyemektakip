import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase/server'
import { oturumBilgisi } from '@/lib/yetki'

/**
 * Tüm veritabanının tek dosyalık yedeği.
 *
 * Veri yalnızca Supabase'de duruyor ve ücretsiz planda geri yüklenebilir bir
 * yedek yok; sistem kullanılamaz hâle gelirse elde bir kopya olmalı. Bu uç
 * nokta oturum açmış kullanıcının okuyabildiği her tabloyu olduğu gibi verir,
 * dönüştürmez — yeni bir kuruluma aynen basılabilsin diye.
 */

/** Yedeğe giren tablolar. Sıra, geri yüklerken bağımlılıkları bozmayacak şekilde. */
const TABLOLAR = [
  'okullar',
  'profiles',
  'app_settings',
  'ucret_gecmisi',
  'sezonlar',
  'taksit_plani',
  'students',
  'ogrenci_taksit',
  'transactions',
  'serbest_ogunler',
  'menu_listeleri',
  'menu_gunleri',
  'malzemeler',
  'yemek_receteleri',
  'hizmet_noktalari',
  'hizmet_fiyatlari',
  'gunluk_hizmet',
  'gunluk_cikan',
  'cariler',
  'faturalar',
  'fatura_tahsilatlari',
  'personeller',
  'personel_ucretleri',
  'maas_odemeleri',
  'donemsel_giderler',
  'okulsuz_gunler',
  'abonelik_donemleri',
  'senetler',
  'fatura_gizli',
  'personel_gizli',
  'sgk_gizli',
  'audit_log',
] as const

/** Hesaplanan görünümler: geri yüklemede gerekmez ama okumak için değerli. */
const GORUNUMLER = ['student_balances'] as const

export async function GET() {
  const oturum = await oturumBilgisi()
  if (!oturum) {
    return NextResponse.json({ hata: 'Oturum gerekli.' }, { status: 401 })
  }

  const supabase = await supabaseServer()
  const veri: Record<string, unknown[]> = {}
  const sayim: Record<string, number> = {}
  const hatalar: Record<string, string> = {}

  for (const tablo of [...TABLOLAR, ...GORUNUMLER]) {
    // Sayfalama: tek istekte dönen satır sayısı sınırlı olabiliyor
    const satirlar: unknown[] = []
    let bas = 0
    const adim = 1000

    for (;;) {
      const { data, error } = await supabase
        .from(tablo)
        .select('*')
        .range(bas, bas + adim - 1)

      if (error) {
        hatalar[tablo] = error.message
        break
      }
      satirlar.push(...(data ?? []))
      if (!data || data.length < adim) break
      bas += adim
    }

    veri[tablo] = satirlar
    sayim[tablo] = satirlar.length
  }

  const yedek = {
    olusturulma: new Date().toISOString(),
    kaynak: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    alan: oturum.email ?? null,
    satir_sayilari: sayim,
    ...(Object.keys(hatalar).length > 0 ? { okunamayan: hatalar } : {}),
    veri,
  }

  const dosyaAdi = `yemektakip-yedek-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(yedek, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${dosyaAdi}"`,
      'cache-control': 'no-store',
    },
  })
}
