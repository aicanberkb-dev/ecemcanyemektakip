import { supabaseServer } from '@/lib/supabase/server'

import { KartEkrani, type GirilmisSatir } from './KartEkrani'

export const metadata = { title: 'Kart Harcamaları — Yemek Takip' }

/** Deftere yazılmış kart harcamaları bu önekle ayırt ediliyor */
const ONEK = 'Kredi kartı · '

/**
 * Kart Harcamaları: ekstredeki POS satırlarını deftere aktarma ve rapor.
 *
 * Aktarım öğrenci ekstresindeki mantığın aynısı — dosya tarayıcıda okunur,
 * önizleme gösterilir, onaydan sonra sunucuya yazılır. Rapor ise şimdiye
 * kadar aktarılmış bütün kart harcamaları üzerinden kümülatif çalışıyor.
 */
export default async function KartPage() {
  const supabase = await supabaseServer()

  const { data, error } = await supabase
    .from('gunluk_gider')
    .select('tarih, tutar, masraf_noktasi, aciklama, banka_fis_no')
    .like('aciklama', `${ONEK}%`)
    .order('tarih', { ascending: false })

  const girilmisler: GirilmisSatir[] = (
    (data ?? []) as {
      tarih: string
      tutar: number | string
      masraf_noktasi: string | null
      aciklama: string | null
      banka_fis_no: string | null
    }[]
  ).map((r) => ({
    tarih: r.tarih,
    tutar: Number(r.tutar),
    isyeri: r.masraf_noktasi ?? '—',
    hamAd: (r.aciklama ?? '').slice(ONEK.length) || '—',
    anahtar: r.banka_fis_no,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">Kart Harcamaları</h1>
        <p className="text-sm text-solgun">
          Banka ekstresini yükleyin; kartla yapılan harcamalar (POS satırları)
          ayıklanıp günlük masraf defterine yazılır. Aynı ekstreyi tekrar
          yüklerseniz daha önce girilmiş satırlar işaretli gelir, ikinci kez
          yazılmaz. Alttaki rapor bugüne kadar aktarılmış bütün kart
          harcamalarını gösterir.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <KartEkrani girilmisler={girilmisler} />
    </div>
  )
}
