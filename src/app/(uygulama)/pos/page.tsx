import { aktifOkul } from '@/lib/okul'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { taksitHaritasi } from '@/lib/taksit-sunucu'
import { okulKapaliGunleri } from '@/lib/okulsuz'
import { supabaseServer } from '@/lib/supabase/server'

import { PosEkrani } from './PosEkrani'

export const metadata = { title: 'Yemekhane — Yemek Takip' }

export default async function PosPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  // Ücretli öğünün varsayılan fiyatı: bugün geçerli tarifeden gelir.
  // Ekranda değiştirilebilir ama başlangıç değeri hep tarifedir.
  const supabase = await supabaseServer()
  const bugun = await bugunSunucu()

  // Aylıkçı seçilince taksit durumu görünsün: bakiye aylıkçıda hiçbir şey
  // söylemiyor, ödeme sorusunun cevabı taksit planında.
  const [{ data }, taksitler] = await Promise.all([
    supabase
      .rpc('ucretler', { p_okul_id: okul.id, p_tarih: bugun })
      .maybeSingle(),
    taksitHaritasi(okul.id),
  ])

  // Bugun resmi tatil / ara tatil mi? Yemek kaydi girilebilir ama uyarilir.
  // Genel tatil ya da bu okula özel kapalı gün (diğer okulunki değil)
  const tatil = (await okulKapaliGunleri(supabase, okul.id, bugun, bugun))[0] ?? null

  const tarife = data as { taban_gunluk_ucret: number } | null
  const ucretliVarsayilan = Number(tarife?.taban_gunluk_ucret ?? 0)

  // key: okul değişince ekran tamamen sıfırlanır, önceki okulun öğrencisi kalmaz
  return (
    <PosEkrani
      key={okul.id}
      okulId={okul.id}
      okulAdi={okul.ad}
      ucretliVarsayilan={ucretliVarsayilan}
      taksitler={Object.fromEntries(taksitler)}
      tatilSebebi={(tatil as { sebep: string | null } | null)?.sebep ?? null}
    />
  )
}
