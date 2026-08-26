import { aktifOkul } from '@/lib/okul'
import { taksitHaritasi } from '@/lib/taksit-sunucu'
import { supabaseServer } from '@/lib/supabase/server'

import { PosEkrani } from './PosEkrani'

export const metadata = { title: 'Yemekhane — Yemek Takip' }

export default async function PosPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  // Ücretli öğünün varsayılan fiyatı: bugün geçerli tarifeden gelir.
  // Ekranda değiştirilebilir ama başlangıç değeri hep tarifedir.
  const supabase = await supabaseServer()

  // Aylıkçı seçilince taksit durumu görünsün: bakiye aylıkçıda hiçbir şey
  // söylemiyor, ödeme sorusunun cevabı taksit planında.
  const [{ data }, taksitler] = await Promise.all([
    supabase
      .rpc('ucretler', { p_okul_id: okul.id })
      .maybeSingle(),
    taksitHaritasi(okul.id),
  ])

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
    />
  )
}
