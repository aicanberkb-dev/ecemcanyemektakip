import Link from 'next/link'

import { para, tarih as tarihBicim, tarihSaat } from '@/lib/format'

export type AktarimKaydi = {
  id: string
  dosyaAdi: string
  aktaran: string
  aktarmaZamani: string
  ekstreBas: string | null
  ekstreBit: string | null
  satirSayisi: number
  eklenen: number
  atlanan: number
  mukerrerAtlanan: number
  toplamTutar: number
  kayitlar: { id: string; ogrenci: string; tarih: string; tutar: number }[]
}

/** "8 – 15 Eylül 2026" ya da tek günse "15 Eylül 2026" */
function aralik(bas: string | null, bit: string | null): string {
  if (!bas || !bit) return '—'
  return bas === bit ? tarihBicim(bas) : `${tarihBicim(bas)} – ${tarihBicim(bit)}`
}

/**
 * Aktarım geçmişi.
 *
 * Mükerrer bir ödeme fark edildiğinde geriye dönüp bakılacak bir iz yoktu:
 * tahsilatlar tek tek görünüyor ama hangisinin hangi dosyadan, ne zaman
 * geldiği bilinmiyordu. Her satır o aktarımın kayıtlarına açılıyor.
 */
export function AktarimGecmisi({ kayitlar }: { kayitlar: AktarimKaydi[] }) {
  if (kayitlar.length === 0) {
    return (
      <div className="kart p-4 text-sm text-solgun">
        Bu okulda henüz ekstre aktarımı yapılmamış.
      </div>
    )
  }

  return (
    <div className="kart divide-y divide-cizgi">
      <div className="px-4 py-3">
        <h2 className="font-semibold">Aktarım Geçmişi</h2>
        <p className="text-xs text-solgun">Son {kayitlar.length} aktarım</p>
      </div>

      {kayitlar.map((a) => (
        <details key={a.id} className="group">
          <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-slate-50">
            <span className="font-medium">{aralik(a.ekstreBas, a.ekstreBit)}</span>
            <span className="text-solgun">arası tahsilatları içeren ekstre</span>
            <span className="font-medium">{tarihSaat(a.aktarmaZamani)}</span>
            <span className="text-solgun">tarihinde aktarıldı</span>

            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="rozet bg-emerald-100 text-emerald-800">
                {a.eklenen} kayıt · {para(a.toplamTutar)}
              </span>
              {a.mukerrerAtlanan > 0 && (
                <span className="rozet bg-amber-100 text-amber-800">
                  {a.mukerrerAtlanan} mükerrer atlandı
                </span>
              )}
              {a.atlanan > 0 && (
                <span className="rozet bg-gray-100 text-gray-700">
                  {a.atlanan} daha önce aktarılmış
                </span>
              )}
            </span>
          </summary>

          <div className="space-y-3 border-t border-cizgi bg-slate-50 px-4 py-3 text-sm">
            <p className="text-xs text-solgun">
              <strong>Dosya:</strong> {a.dosyaAdi} · <strong>Aktaran:</strong> {a.aktaran} ·
              dosyada <strong>{a.satirSayisi}</strong> para girişi okundu
            </p>

            {a.kayitlar.length === 0 ? (
              <p className="text-solgun">
                Bu aktarımda hiç kayıt yazılmamış
                {a.mukerrerAtlanan > 0 && ' — tamamı zaten girilmiş ödemelerdi'}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tablo">
                  <thead>
                    <tr>
                      <th>Öğrenci</th>
                      <th>Ödeme Tarihi</th>
                      <th className="text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.kayitlar.map((k) => (
                      <tr key={k.id}>
                        <td>{k.ogrenci}</td>
                        <td className="whitespace-nowrap">{tarihBicim(k.tarih)}</td>
                        <td className="text-right tabular-nums">{para(k.tutar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Link href="/reports/tahsilat" className="text-vurgu hover:underline">
              Tahsilat raporunda gör →
            </Link>
          </div>
        </details>
      ))}
    </div>
  )
}
