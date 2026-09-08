/**
 * Mükerrer tahsilat ölçütü.
 *
 * Aynı öğrenciye, aynı güne, aynı tutarda ikinci bir tahsilat neredeyse her
 * zaman yanlışlıkla girilmiştir. Elle giriş ekranında bu kontrol vardı; ekstre
 * aktarımında yoktu ve elle girilen bir ödeme ekstreden ikinci kez işlenebiliyordu.
 *
 * Banka fiş numarası bu işi göremiyor: elle girilen ödemenin fiş numarası yok,
 * dolayısıyla ekstredeki satırla aynı anahtara düşmüyor.
 */
export type MevcutTahsilat = {
  studentId: string
  tarih: string
  tutar: number
}

export function tahsilatAnahtari(
  studentId: string,
  tarih: string,
  tutar: number,
): string {
  // Kuruş farkları yuvarlanır: 40000 ile 40000.001 aynı ödemedir.
  return `${studentId}|${tarih}|${tutar.toFixed(2)}`
}

export function mukerrerAnahtarlar(kayitlar: MevcutTahsilat[]): Set<string> {
  return new Set(kayitlar.map((k) => tahsilatAnahtari(k.studentId, k.tarih, k.tutar)))
}
