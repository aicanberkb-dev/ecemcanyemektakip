import { supabaseServer } from '@/lib/supabase/server'

import { MalzemeBolumu, type Malzeme } from './MalzemeBolumu'

export const metadata = { title: 'Malzemeler — Yemek Takip' }

export default async function MalzemelerPage() {
  const supabase = await supabaseServer()

  const [{ data: malzemeVeri }, { data: kullanimVeri }] = await Promise.all([
    supabase.from('malzemeler').select('*').order('ad'),
    supabase.from('yemek_receteleri').select('malzeme_id'),
  ])

  const malzemeler = (malzemeVeri ?? []) as Malzeme[]

  // Hangi malzeme kaç yemekte geçiyor — fiyatı önce hangisine gireceği belli olsun
  const kullanim = new Map<string, number>()
  for (const r of (kullanimVeri ?? []) as { malzeme_id: string }[]) {
    kullanim.set(r.malzeme_id, (kullanim.get(r.malzeme_id) ?? 0) + 1)
  }

  const fiyatsiz = malzemeler.filter((m) => Number(m.birim_fiyat) === 0).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Maliyet</h1>
        <p className="text-sm text-solgun">
          Malzeme fiyatları → yemek reçeteleri → günlük menü maliyeti → kâr/zarar.
          Zincirin ilk halkası burası.
        </p>
      </div>

      {fiyatsiz > 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{fiyatsiz}</strong> malzemenin fiyatı henüz girilmemiş. Fiyatı 0 olan
          malzeme maliyete hiç yansımaz — hesap olduğundan ucuz çıkar.
        </p>
      )}

      <MalzemeBolumu
        malzemeler={malzemeler}
        kullanim={Object.fromEntries(kullanim)}
      />
    </div>
  )
}
