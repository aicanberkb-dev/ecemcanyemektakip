/**
 * Rapor dönemi: ay seçimi ya da serbest tarih aralığı.
 *
 * Ekranların çoğu ay bazlı çalışıyordu; ay atlayan bir soru sorulamıyordu
 * ("15 Ağustos – 15 Eylül arası ne oldu?"). Ay seçimi duruyor, yanına serbest
 * aralık geldi: başlangıç ve bitiş dolduruldu mu aralık kazanır.
 */

export type DonemSorgusu = {
  yil?: string
  ay?: string
  bas?: string
  bit?: string
}

export type Donem = {
  /** Sorgularda kullanılan gerçek aralık */
  bas: string
  bit: string
  /** Ay seçimi — serbest aralıkta da form bunu gösterir */
  yil: number
  ay: number
  /** Serbest aralık mı seçili? */
  ozel: boolean
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Ayın ilk ve son günü, yerel saat diliminden bağımsız. */
export function ayAralik(yil: number, ay: number): { bas: string; bit: string } {
  const iki = (n: number) => String(n).padStart(2, '0')
  return {
    bas: `${yil}-${iki(ay)}-01`,
    bit: `${yil}-${iki(ay)}-${iki(new Date(yil, ay, 0).getDate())}`,
  }
}

/**
 * Adres çubuğundaki parametrelerden dönemi çözer.
 *
 * Serbest aralık yalnızca iki tarih de geçerliyse devreye girer; ters
 * verilmişse (bitiş başlangıçtan önce) ikisi yer değiştirir — kullanıcıya
 * hata göstermek yerine kastettiği aralığı vermek daha faydalı.
 */
export function donemCoz(q: DonemSorgusu, simdi = new Date()): Donem {
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  if (q.bas && q.bit && ISO.test(q.bas) && ISO.test(q.bit)) {
    const [bas, bit] = q.bas <= q.bit ? [q.bas, q.bit] : [q.bit, q.bas]
    return { bas, bit, yil, ay, ozel: true }
  }

  return { ...ayAralik(yil, ay), yil, ay, ozel: false }
}

/** Dönemi bağlantı parametresine çevirir — sekmeler arası taşımak için. */
export function donemParametreleri(d: Donem): string {
  return d.ozel
    ? `bas=${d.bas}&bit=${d.bit}`
    : `yil=${d.yil}&ay=${d.ay}`
}
