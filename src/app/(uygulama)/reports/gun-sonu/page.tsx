import Link from 'next/link'

import { AboneRozeti } from '@/components/Rozetler'
import { para, tarih as tarihBicim, tarihSaat } from '@/lib/format'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'
import type { GunSonu, SerbestOgun, Transaction } from '@/lib/types'

export const metadata = { title: 'Gün Sonu — Yemek Takip' }

type Yiyen = Transaction & { students: { ad_soyad: string; ogrenci_no: string; sinif: string | null } | null }

export default async function GunSonuPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string }>
}) {
  const { gun: gunQ } = await searchParams
  const gun = gunQ || await bugunSunucu()

  const supabase = await supabaseServer()
  const okul = await aktifOkul()
  if (!okul) return null

  const [{ data: ozetVeri }, { data: yiyenVeri }, { data: serbestVeri }, { data: menuVeri }] =
    await Promise.all([
    supabase.rpc('gun_sonu', { p_okul_id: okul.id, p_tarih: gun }),
    supabase
      .from('transactions')
      .select('*, students!inner(ad_soyad, ogrenci_no, sinif, okul_id)')
      .eq('students.okul_id', okul.id)
      .eq('tarih', gun)
      .not('ogun_abone_tipi', 'is', null)
      .order('created_at'),
    supabase
      .from('serbest_ogunler')
      .select('*')
      .eq('okul_id', okul.id)
      .eq('tarih', gun)
      .order('created_at'),
    // O günün menüsü: okulun kendi listesinden, kaç kişinin hangi yemeğe
    // geldiği buradan izleniyor
    supabase
      .from('menu_gunleri')
      .select('corba, ana_yemek, yardimci, ek, menu_listeleri!inner(okul_id)')
      .eq('menu_listeleri.okul_id', okul.id)
      .eq('tarih', gun)
      .maybeSingle(),
  ])

  const ozet = (ozetVeri?.[0] ?? null) as GunSonu | null
  const yiyenler = (yiyenVeri ?? []) as Yiyen[]
  const serbestler = (serbestVeri ?? []) as SerbestOgun[]
  const menu = menuVeri as unknown as {
    corba: string | null
    ana_yemek: string | null
    yardimci: string | null
    ek: string | null
  } | null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Gün Sonu — {tarihBicim(gun)}</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>

      <form className="kart flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="etiket" htmlFor="gun">
            Tarih
          </label>
          <input id="gun" type="date" name="gun" defaultValue={gun} className="girdi" />
        </div>
        <button className="btn-birincil">Göster</button>
        <Link href="/reports/gun-sonu" className="btn-ikincil">
          Bugün
        </Link>
      </form>

      {/* O günün menüsü — katılım sayısıyla birlikte okunsun diye üstte */}
      <div className="kart p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Günün Menüsü</h2>
          <Link href="/menu" className="text-sm text-vurgu hover:underline">
            Yemek listesini düzenle →
          </Link>
        </div>
        {menu ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ['Çorba', menu.corba, 'bg-orange-100 text-orange-900'],
              ['Ana Yemek', menu.ana_yemek, 'bg-red-100 text-red-900'],
              ['Yardımcı', menu.yardimci, 'bg-amber-100 text-amber-900'],
              ['4. Kalem', menu.ek, 'bg-sky-100 text-sky-900'],
            ]
              .filter(([, deger]) => deger)
              .map(([etiket, deger, renk]) => (
                <span key={etiket as string} className={`rounded-md px-3 py-2 ${renk}`}>
                  <span className="block text-xs opacity-70">{etiket}</span>
                  <span className="font-semibold">{deger}</span>
                </span>
              ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-solgun">
            Bu güne menü girilmemiş.{' '}
            <Link href="/menu" className="text-vurgu hover:underline">
              Yemek listesinden ekleyin
            </Link>
            .
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Sayac baslik="Günlükçü" adet={ozet?.gunlukcu ?? 0} alt={para(ozet?.gunlukcu_tutar ?? 0)} renk="bg-blue-50 text-blue-800" />
        <Sayac baslik="Aylıkçı" adet={ozet?.aylikci ?? 0} alt="ücret düşmez" renk="bg-amber-50 text-amber-800" />
        <Sayac baslik="Ücretli" adet={ozet?.ucretli ?? 0} alt={para(ozet?.ucretli_tutar ?? 0)} renk="bg-emerald-50 text-emerald-800" />
        <Sayac baslik="Misafir" adet={ozet?.misafir ?? 0} alt={para(ozet?.misafir_tutar ?? 0)} renk="bg-purple-50 text-purple-800" />
        <Sayac baslik="Toplam" adet={ozet?.toplam ?? 0} alt="kişi yemek yedi" renk="bg-slate-100 text-slate-800" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="kart overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
            Yemek yiyen öğrenciler ({yiyenler.length})
          </h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Saat</th>
                <th>Öğrenci</th>
                <th>Sınıf</th>
                <th>Abone</th>
                <th className="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {yiyenler.map((y) => (
                <tr key={y.id}>
                  <td className="whitespace-nowrap text-solgun">
                    {new Date(y.created_at).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <Link
                      href={`/students/${y.student_id}`}
                      className="text-vurgu hover:underline"
                    >
                      {y.students?.ad_soyad ?? '—'}
                    </Link>
                  </td>
                  <td>{y.students?.sinif ?? '—'}</td>
                  <td>{y.ogun_abone_tipi && <AboneRozeti tip={y.ogun_abone_tipi} />}</td>
                  <td className="text-right tabular-nums">{para(y.tutar)}</td>
                </tr>
              ))}
              {yiyenler.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-solgun">
                    Bu tarihte öğrenci öğünü yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="kart overflow-x-auto">
          <h2 className="border-b border-cizgi px-4 py-3 font-semibold">
            Ücretli / Misafir öğünler ({serbestler.length})
          </h2>
          <table className="tablo">
            <thead>
              <tr>
                <th>Saat</th>
                <th>Tip</th>
                <th>Açıklama</th>
                <th className="text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {serbestler.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap text-solgun">{tarihSaat(s.created_at).slice(11)}</td>
                  <td>
                    {s.tip === 'ucretli' ? (
                      <span className="rozet bg-emerald-100 text-emerald-800">Ücretli</span>
                    ) : (
                      <span className="rozet bg-purple-100 text-purple-800">Misafir</span>
                    )}
                  </td>
                  <td className="text-solgun">{s.aciklama ?? '—'}</td>
                  <td className="text-right tabular-nums">{para(s.tutar)}</td>
                </tr>
              ))}
              {serbestler.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-solgun">
                    Bu tarihte ücretli/misafir öğün yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Sayac({
  baslik,
  adet,
  alt,
  renk,
}: {
  baslik: string
  adet: number
  alt: string
  renk: string
}) {
  return (
    <div className={`kart p-4 ${renk}`}>
      <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{baslik}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{adet}</p>
      <p className="mt-1 text-xs opacity-75">{alt}</p>
    </div>
  )
}
