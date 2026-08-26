import { para, tarih as tarihBicim } from '@/lib/format'

/** Aylıkçının taksit durumu — `taksit_durumu(sezon)` çıktısının sayısal hâli. */
export type TaksitBilgisi = {
  yillik_toplam: number
  vadesi_gelen: number
  odenen: number
  eksik: number
  odeme_alinmali: boolean
  son_vade: string | null
  ozel_plan: boolean
}

/**
 * Aylıkçının ödeme durumu tek rozette.
 *
 * Aylıkçının bakiyesi yanıltıcı: öğün ücreti düşülmediği için "kalan" hep
 * yatırılan paraya eşit görünüyor ve borçlu öğrenci borçsuz gibi duruyor.
 * Ölçü taksit planı; bu rozet aynı cevabı yemekhanede, öğrenci listesinde ve
 * raporlarda aynı sözcüklerle veriyor.
 */
export function TaksitRozeti({
  taksit,
  tutarGoster = true,
}: {
  taksit: TaksitBilgisi | null | undefined
  /** Eksik tutarı rozetin içinde yaz */
  tutarGoster?: boolean
}) {
  if (!taksit || taksit.yillik_toplam === 0) {
    return (
      <span
        className="rozet bg-amber-100 text-amber-800"
        title="Taksit planı tanımlı olmadığından ödeme durumu ölçülemiyor"
      >
        taksit planı yok
      </span>
    )
  }

  if (taksit.eksik > 0) {
    return (
      <span
        className="rozet bg-red-100 text-red-800"
        title={
          taksit.son_vade
            ? `Son vade ${tarihBicim(taksit.son_vade)} · vadesi gelen ${para(
                taksit.vadesi_gelen,
              )}, ödenen ${para(taksit.odenen)}`
            : undefined
        }
      >
        taksit ödenmedi
        {tutarGoster && <span className="ml-1 font-normal">{para(taksit.eksik)}</span>}
      </span>
    )
  }

  return <span className="rozet bg-emerald-100 text-emerald-800">taksitler ödendi</span>
}
