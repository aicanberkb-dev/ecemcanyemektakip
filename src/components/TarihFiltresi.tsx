'use client'

import { useMemo } from 'react'

import { AY_ADLARI } from '@/lib/format'

/** '2026-09' → 'Eylül 2026' */
export function ayEtiketi(ay: string): string {
  const [yil, no] = ay.split('-')
  return `${AY_ADLARI[Number(no) - 1]} ${yil}`
}

/** Ayın ilk ve son günü: seçilince tarih aralığı oraya daralır */
export function ayAraligi(ay: string): { bas: string; bit: string } {
  const [yil, no] = ay.split('-').map(Number)
  const son = new Date(yil, no, 0).getDate()
  return { bas: `${ay}-01`, bit: `${ay}-${String(son).padStart(2, '0')}` }
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

/** Bir günü kaydırır: gunEkle('2026-09-22', -1) → '2026-09-21' */
export function gunEkle(tarih: string, adet: number): string {
  const d = new Date(`${tarih}T00:00:00`)
  d.setDate(d.getDate() + adet)
  return iso(d)
}

/** İçinde bulunulan haftanın pazartesi–pazar aralığı */
export function haftaAraligi(tarih: string): { bas: string; bit: string } {
  const d = new Date(`${tarih}T00:00:00`)
  // Pazar 0 geliyor; pazartesi başlangıç olacak şekilde kaydırılır
  const pazartesiyeKalan = (d.getDay() + 6) % 7
  const bas = gunEkle(tarih, -pazartesiyeKalan)
  return { bas, bit: gunEkle(bas, 6) }
}

export type Aralik = { bas: string; bit: string; ay: string }

export const BOS_ARALIK: Aralik = { bas: '', bit: '', ay: '' }

/** Bir tarihin seçili aralığa düşüp düşmediği */
export function araliktaMi(tarih: string, a: Aralik): boolean {
  if (a.bas && tarih < a.bas) return false
  if (a.bit && tarih > a.bit) return false
  return true
}

/**
 * Tarih aralığı süzgeci: hızlı düğmeler, ay seçimi ve iki tarih kutusu.
 *
 * Ekrem Günlük Masraf ekranında yazılmıştı; kart harcamaları ve para akışı
 * ekranları da aynısını isteyince buraya alındı. Sağdaki `ozet` alanı
 * çağıran ekrana bırakılıyor — her ekran kendi toplamını gösteriyor.
 */
export function TarihFiltresi({
  bugun,
  aralik,
  degistir,
  aylar,
  ozet,
}: {
  bugun: string
  aralik: Aralik
  degistir: (a: Aralik) => void
  /** Veride geçen aylar ('2026-11'), yeniden eskiye */
  aylar: string[]
  /** Sağda duracak özet; genelde seçili aralığın toplamı */
  ozet?: React.ReactNode
}) {
  const hizli = useMemo(() => {
    const dun = gunEkle(bugun, -1)
    const hafta = haftaAraligi(bugun)
    return [
      { ad: 'Dün', bas: dun, bit: dun },
      { ad: 'Bugün', bas: bugun, bit: bugun },
      { ad: 'Bu hafta', bas: hafta.bas, bit: hafta.bit },
    ]
  }, [bugun])

  const doluMu = !!(aralik.bas || aralik.bit || aralik.ay)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {hizli.map((h) => {
          const secili = aralik.bas === h.bas && aralik.bit === h.bit
          return (
            <button
              key={h.ad}
              type="button"
              aria-pressed={secili}
              onClick={() =>
                degistir(secili ? BOS_ARALIK : { bas: h.bas, bit: h.bit, ay: '' })
              }
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                secili ? 'border-vurgu bg-blue-50 text-vurgu' : 'border-cizgi hover:bg-slate-50'
              }`}
            >
              {h.ad}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <label className="etiket text-xs" htmlFor="tf-ay">
            Ay
          </label>
          <select
            id="tf-ay"
            value={aralik.ay}
            onChange={(e) => {
              const secilen = e.target.value
              if (!secilen) return degistir(BOS_ARALIK)
              degistir({ ...ayAraligi(secilen), ay: secilen })
            }}
            className="girdi !py-1.5"
          >
            <option value="">Tüm aylar</option>
            {aylar.map((a) => (
              <option key={a} value={a}>
                {ayEtiketi(a)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="tf-bas">
            Başlangıç
          </label>
          <input
            id="tf-bas"
            type="date"
            value={aralik.bas}
            onChange={(e) => degistir({ ...aralik, bas: e.target.value, ay: '' })}
            className="girdi !py-1.5"
          />
        </div>
        <div>
          <label className="etiket text-xs" htmlFor="tf-bit">
            Bitiş
          </label>
          <input
            id="tf-bit"
            type="date"
            value={aralik.bit}
            onChange={(e) => degistir({ ...aralik, bit: e.target.value, ay: '' })}
            className="girdi !py-1.5"
          />
        </div>
        {doluMu && (
          <button
            type="button"
            className="btn-ikincil !py-1.5"
            onClick={() => degistir(BOS_ARALIK)}
          >
            Temizle
          </button>
        )}
        {ozet && <div className="ml-auto text-right">{ozet}</div>}
      </div>
    </div>
  )
}
