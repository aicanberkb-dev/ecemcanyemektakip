import Link from 'next/link'

import { tarihSaat } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'
import type { AuditLog, Profile } from '@/lib/types'

import { FarkGorunumu } from './FarkGorunumu'

export const metadata = { title: 'İşlem Geçmişi — Yemek Takip' }

const TABLO_ADLARI: Record<string, string> = {
  students: 'Öğrenci',
  transactions: 'İşlem',
  profiles: 'Kullanıcı',
  app_settings: 'Ayarlar',
  taksit_plani: 'Taksit Planı',
  serbest_ogunler: 'Serbest Öğün',
}

const SAYFA_BOYUTU = 50

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ tablo?: string; islem?: string; sayfa?: string }>
}) {
  const q = await searchParams
  const sayfa = Math.max(1, Number(q.sayfa) || 1)
  const bas = (sayfa - 1) * SAYFA_BOYUTU

  const supabase = await supabaseServer()

  let sorgu = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('tarih', { ascending: false })
    .range(bas, bas + SAYFA_BOYUTU - 1)

  if (q.tablo) sorgu = sorgu.eq('tablo_adi', q.tablo)
  if (q.islem) sorgu = sorgu.eq('islem_tipi', q.islem)

  const [{ data, error, count }, { data: profilVeri }] = await Promise.all([
    sorgu,
    supabase.from('profiles').select('id, ad_soyad'),
  ])

  const kayitlar = (data ?? []) as AuditLog[]
  const profiller = new Map(
    ((profilVeri ?? []) as Pick<Profile, 'id' | 'ad_soyad'>[]).map((p) => [p.id, p.ad_soyad]),
  )

  const toplamSayfa = Math.max(1, Math.ceil((count ?? 0) / SAYFA_BOYUTU))
  const yol = (s: number) =>
    `/admin/audit-log?sayfa=${s}${q.tablo ? `&tablo=${q.tablo}` : ''}${q.islem ? `&islem=${q.islem}` : ''}`

  return (
    <div className="space-y-4">
      <div>
        <h1 className="baslik">İşlem Geçmişi</h1>
        <p className="mt-1 text-sm text-solgun">
          Tüm düzeltme ve silme işlemleri veritabanı trigger&apos;ı tarafından otomatik
          kaydedilir; uygulama üzerinden değiştirilemez.
        </p>
      </div>

      <form className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket" htmlFor="tablo">
            Kayıt tipi
          </label>
          <select id="tablo" name="tablo" defaultValue={q.tablo ?? ''} className="girdi">
            <option value="">Hepsi</option>
            {Object.entries(TABLO_ADLARI).map(([deger, ad]) => (
              <option key={deger} value={deger}>
                {ad}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiket" htmlFor="islem">
            İşlem
          </label>
          <select id="islem" name="islem" defaultValue={q.islem ?? ''} className="girdi">
            <option value="">Hepsi</option>
            <option value="UPDATE">Düzeltme</option>
            <option value="DELETE">Silme</option>
          </select>
        </div>
        <button className="btn-birincil">Filtrele</button>
        <Link href="/admin/audit-log" className="btn-ikincil">
          Temizle
        </Link>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Kullanıcı</th>
              <th>Kayıt Tipi</th>
              <th>İşlem</th>
              <th>Değişiklik</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((k) => (
              <tr key={k.id}>
                <td className="align-top whitespace-nowrap">{tarihSaat(k.tarih)}</td>
                <td className="align-top">
                  {k.user_id ? (profiller.get(k.user_id) ?? 'Bilinmeyen') : 'Sistem'}
                </td>
                <td className="align-top">{TABLO_ADLARI[k.tablo_adi] ?? k.tablo_adi}</td>
                <td className="align-top">
                  {k.islem_tipi === 'DELETE' ? (
                    <span className="rozet bg-red-100 text-red-800">Silme</span>
                  ) : (
                    <span className="rozet bg-amber-100 text-amber-800">Düzeltme</span>
                  )}
                </td>
                <td className="align-top">
                  <FarkGorunumu eski={k.eski_deger} yeni={k.yeni_deger} />
                </td>
              </tr>
            ))}
            {kayitlar.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-solgun">
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toplamSayfa > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-solgun">
            {count} kayıt · sayfa {sayfa}/{toplamSayfa}
          </span>
          <div className="flex gap-2">
            {sayfa > 1 && (
              <Link href={yol(sayfa - 1)} className="btn-ikincil !py-1.5">
                ← Önceki
              </Link>
            )}
            {sayfa < toplamSayfa && (
              <Link href={yol(sayfa + 1)} className="btn-ikincil !py-1.5">
                Sonraki →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
