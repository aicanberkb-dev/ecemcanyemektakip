'use client'

import { useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'

/** Teknik alan adlarını okunabilir başlığa çevirir. */
const ALAN_ADLARI: Record<string, string> = {
  ogrenci_no: 'Öğrenci No',
  ad_soyad: 'Ad Soyad',
  sinif: 'Sınıf',
  kimlik_no: 'Kimlik No',
  veli_adi: 'Veli Adı',
  veli_telefon: 'Veli Telefon',
  iskonto_orani: 'İskonto Oranı',
  iskonto_tutar: 'İskonto Tutarı',
  devir: 'Devir',
  abone_tipi: 'Abone Tipi',
  aktif: 'Aktif',
  tarih: 'Tarih',
  tip: 'Tip',
  tutar: 'Tutar',
  aciklama: 'Açıklama',
  ogun_abone_tipi: 'Öğün Abone Tipi',
  islemi_yapan_user_id: 'İşlemi Yapan',
  taban_gunluk_ucret: 'Taban Günlük Ücret',
  ucretli_ogun_ucreti: 'Ücretli Öğün Ücreti',
  misafir_ogun_ucreti: 'Misafir Öğün Ücreti',
  yil: 'Yıl',
  ad: 'Ad',
  vade_tarihi: 'Vade Tarihi',
  rol: 'Rol',
}

const PARA_ALANLARI = new Set([
  'tutar',
  'devir',
  'iskonto_tutar',
  'taban_gunluk_ucret',
  'ucretli_ogun_ucreti',
  'misafir_ogun_ucreti',
])

const GIZLI_ALANLAR = new Set(['id', 'created_at', 'updated_at'])

function bicimle(alan: string, deger: unknown): string {
  if (deger === null || deger === undefined || deger === '') return '—'
  if (typeof deger === 'boolean') return deger ? 'Evet' : 'Hayır'
  if (PARA_ALANLARI.has(alan)) return para(Number(deger))
  if (alan === 'tarih' || alan === 'vade_tarihi') return tarihBicim(String(deger))
  if (alan === 'abone_tipi' || alan === 'ogun_abone_tipi') {
    return deger === 'aylik' ? 'Aylıkçı' : 'Günlükçü'
  }
  return String(deger)
}

type Kayit = Record<string, unknown> | null

export function FarkGorunumu({ eski, yeni }: { eski: Kayit; yeni: Kayit }) {
  const [acik, setAcik] = useState(false)

  const alanlar = [...new Set([...Object.keys(eski ?? {}), ...Object.keys(yeni ?? {})])].filter(
    (a) => !GIZLI_ALANLAR.has(a),
  )

  const degisenler = alanlar.filter(
    (a) => JSON.stringify(eski?.[a] ?? null) !== JSON.stringify(yeni?.[a] ?? null),
  )

  // Silme kaydında yeni değer yok — tüm alanları göster
  const gosterilecek = yeni === null ? alanlar : degisenler

  if (gosterilecek.length === 0) {
    return <span className="text-xs text-solgun">Değişiklik yok</span>
  }

  const ozet = gosterilecek
    .slice(0, 3)
    .map((a) => ALAN_ADLARI[a] ?? a)
    .join(', ')

  return (
    <div>
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="text-xs text-vurgu hover:underline"
      >
        {acik ? '▾ ' : '▸ '}
        {ozet}
        {gosterilecek.length > 3 && ` +${gosterilecek.length - 3}`}
      </button>

      {acik && (
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-solgun">
              <th className="py-1 pr-3 text-left font-medium">Alan</th>
              <th className="py-1 pr-3 text-left font-medium">Eski</th>
              <th className="py-1 text-left font-medium">Yeni</th>
            </tr>
          </thead>
          <tbody>
            {gosterilecek.map((a) => (
              <tr key={a} className="border-t border-cizgi">
                <td className="py-1 pr-3 font-medium">{ALAN_ADLARI[a] ?? a}</td>
                <td className="py-1 pr-3 text-red-700 line-through">
                  {bicimle(a, eski?.[a])}
                </td>
                <td className="py-1 text-emerald-700">
                  {yeni === null ? '—' : bicimle(a, yeni?.[a])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
