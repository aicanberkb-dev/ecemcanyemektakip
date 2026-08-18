'use client'

import Link from 'next/link'

import { para, tarih as tarihBicim } from '@/lib/format'
import { ODEME_YONTEMI_ADLARI, type Transaction } from '@/lib/types'

/**
 * Seçili öğrencinin geçmiş tahsilatları. Girilmekte olan tarih ve tutarla
 * eşleşen kayıt varsa mükerrer uyarısı verir — aynı ödemenin iki kez
 * girilmesi en sık yapılan hata.
 *
 * Kayıtları formdan alıyor: aynı veriyi kaydetmeden önceki "aynı güne ödeme
 * var mı" onayı da kullanıyor, iki kez çekmenin anlamı yok.
 */
export function SonTahsilatlar({
  studentId,
  tarih,
  tutar,
  kayitlar,
  yukleniyor,
}: {
  studentId: string | null
  tarih: string
  tutar: string
  kayitlar: Transaction[]
  yukleniyor: boolean
}) {
  if (!studentId) return null

  const gosterilen = kayitlar

  // Türkçe ondalık (virgül) da kabul edilir
  const girilenTutar = Number(tutar.trim().replace(/\./g, '').replace(',', '.'))
  const tutarGecerli = Number.isFinite(girilenTutar) && girilenTutar > 0

  const mukerrer = tutarGecerli
    ? gosterilen.filter(
        (k) => k.tarih === tarih && Math.abs(Number(k.tutar) - girilenTutar) < 0.005,
      )
    : []

  const toplam = gosterilen.reduce((t, k) => t + Number(k.tutar), 0)

  return (
    <div className="space-y-3 border-t border-cizgi pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Bu öğrencinin geçmiş tahsilatları</h2>
        {gosterilen.length > 0 && (
          <span className="text-sm text-solgun">
            {gosterilen.length} kayıt · toplam{' '}
            <strong className="text-emerald-700">{para(toplam)}</strong>
          </span>
        )}
      </div>

      {mukerrer.length > 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Dikkat: {tarihBicim(tarih)} tarihine {para(girilenTutar)} tutarında{' '}
          {mukerrer.length > 1 ? `${mukerrer.length} kayıt` : 'bir kayıt'} zaten var.
          Aynı ödemeyi ikinci kez giriyor olabilirsiniz.
        </p>
      )}

      {yukleniyor ? (
        <p className="text-sm text-solgun">Yükleniyor…</p>
      ) : gosterilen.length === 0 ? (
        <p className="text-sm text-solgun">
          Bu öğrenciye ait tahsilat kaydı yok — ilk ödemesi olacak.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-md border border-cizgi">
          <table className="tablo">
            <thead className="sticky top-0">
              <tr>
                <th>Tarih</th>
                <th>Yöntem</th>
                <th>Açıklama</th>
                <th className="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {gosterilen.map((k) => {
                const eslesiyor = mukerrer.some((m) => m.id === k.id)
                return (
                  <tr key={k.id} className={eslesiyor ? 'bg-amber-100' : ''}>
                    <td className="whitespace-nowrap">
                      {tarihBicim(k.tarih)}
                      {eslesiyor && (
                        <span className="rozet ml-2 bg-amber-500 text-white">aynı</span>
                      )}
                    </td>
                    <td>
                      {k.odeme_yontemi ? (
                        <span className="rozet bg-slate-100 text-slate-700">
                          {ODEME_YONTEMI_ADLARI[k.odeme_yontemi]}
                        </span>
                      ) : (
                        <span className="text-solgun">—</span>
                      )}
                    </td>
                    <td className="text-solgun">{k.aciklama ?? '—'}</td>
                    <td className="text-right font-medium tabular-nums text-emerald-700">
                      {para(k.tutar)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {gosterilen.length > 0 && (
        <p className="text-xs text-solgun">
          Yanlış girilmiş bir kaydı düzeltmek için{' '}
          <Link href={`/students/${studentId}`} className="text-vurgu hover:underline">
            öğrenci sayfasına
          </Link>{' '}
          gidin.
        </p>
      )}
    </div>
  )
}
