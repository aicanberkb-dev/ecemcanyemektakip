import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

import { PosEkrani } from './PosEkrani'

export const metadata = { title: 'Yemekhane — Yemek Takip' }

export default async function PosPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  // Ücretli öğünün varsayılan fiyatı: bugün geçerli tarifeden gelir.
  // Ekranda değiştirilebilir ama başlangıç değeri hep tarifedir.
  const supabase = await supabaseServer()
  const { data } = await supabase
    .rpc('ucretler', { p_okul_id: okul.id })
    .maybeSingle()

  const tarife = data as {
    taban_gunluk_ucret: number
    ucretli_ogun_ucreti: number
    misafir_ogun_ucreti: number
  } | null

  const ucretliVarsayilan =
    Number(tarife?.ucretli_ogun_ucreti ?? 0) > 0
      ? Number(tarife!.ucretli_ogun_ucreti)
      : Number(tarife?.taban_gunluk_ucret ?? 0)

  // key: okul değişince ekran tamamen sıfırlanır, önceki okulun öğrencisi kalmaz
  return (
    <PosEkrani
      key={okul.id}
      okulId={okul.id}
      okulAdi={okul.ad}
      ucretliVarsayilan={ucretliVarsayilan}
    />
  )
}
