/**
 * Her ay tekrarlanan SGK kalemleri.
 *
 * Maaş gibi sabit bir şablon: liste her ay aynı, kullanıcı yalnızca tutarı
 * yazıp ödendiğinde işaretliyor. Vade ayın son günüdür.
 */
export const SGK_KALEMLERI = [
  'SGK ELMALI',
  'SGK GÖKSU',
  'SGK AKBABA',
  'SGK KONAK',
] as const

export type SgkKalemi = (typeof SGK_KALEMLERI)[number]

export function sgkKalemiMi(tur: string): boolean {
  return (SGK_KALEMLERI as readonly string[]).includes(tur)
}

/** Ayın son günü — SGK'nın sabit vadesi. */
export function ayinSonGunu(yil: number, ay: number): string {
  const g = new Date(yil, ay, 0).getDate()
  return `${yil}-${String(ay).padStart(2, '0')}-${String(g).padStart(2, '0')}`
}
