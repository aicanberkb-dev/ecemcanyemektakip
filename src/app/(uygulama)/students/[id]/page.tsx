import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AboneRozeti, Bakiye, DurumRozeti } from '@/components/Rozetler'
import { para } from '@/lib/format'
import { aktifOkulId } from '@/lib/okul'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { OgrenciTaksitSatiri, StudentBalance, Transaction } from '@/lib/types'

import { ogrenciSil } from '../actions'
import { IskontoFormu } from './IskontoFormu'
import { IslemSatiri } from './IslemSatiri'
import { TaksitBolumu } from './TaksitBolumu'

export default async function OgrenciDetayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sezon?: string }>
}) {
  const { id } = await params
  const { sezon: sezonQ } = await searchParams
  const supabase = await supabaseServer()
  const okulId = await aktifOkulId()

  const [{ data: ozetVeri }, { data: islemVeri }] = await Promise.all([
    // okul_id filtresi: başka okulun öğrencisi URL'den açılamaz
    supabase
      .from('student_balances')
      .select('*')
      .eq('student_id', id)
      .eq('okul_id', okulId)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('*')
      .eq('student_id', id)
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (!ozetVeri) notFound()
  const ozet = ozetVeri as StudentBalance
  const islemler = (islemVeri ?? []) as Transaction[]

  // Taksit planı yalnızca aylıkçılar için anlamlı
  const sezonListesi = ozet.abone_tipi === 'aylik' ? await sezonlariGetir(okulId) : []
  const sezon = sezonSec(sezonListesi, sezonQ)

  const { data: taksitVeri } =
    ozet.abone_tipi === 'aylik' && sezon
      ? await supabase.rpc('ogrenci_taksit_plani', {
          p_student_id: id,
          p_sezon_id: sezon.id,
        })
      : { data: null }
  const taksitSatirlari = (taksitVeri ?? []) as OgrenciTaksitSatiri[]

  const sil = ogrenciSil.bind(null, id)

  return (
    <div className="space-y-5">
      <Link href="/students" className="text-sm text-vurgu hover:underline">
        ← Öğrenciler
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ozet.ad_soyad}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-solgun">
            <span className="tabular-nums">{ozet.ogrenci_no}</span>
            {ozet.sinif && <span>· {ozet.sinif}</span>}
            <AboneRozeti tip={ozet.abone_tipi} />
            <DurumRozeti aktif={ozet.aktif} />
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/students/${id}/edit`} className="btn-ikincil">
            Düzenle
          </Link>
          <form action={sil}>
            <button className="btn-tehlike">Sil</button>
          </form>
        </div>
      </div>

      {/* Cari özet */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OzetKart baslik="Devir" deger={para(ozet.devir)} />
        <OzetKart baslik="Alınan Para" deger={para(ozet.alinan_para)} renk="text-emerald-700" />
        <OzetKart baslik="Harcanan" deger={para(ozet.harcanan)} />
        <div className="kart p-4">
          <p className="text-xs font-medium tracking-wide text-solgun uppercase">Kalan</p>
          <p className="mt-1 text-2xl">
            <Bakiye tutar={Number(ozet.kalan)} kalin />
          </p>
        </div>
      </div>

      {/* Taksit planı — yalnızca aylıkçılarda */}
      {ozet.abone_tipi === 'aylik' && (
        <div className="kart p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              Taksit Planı{sezon ? ` — ${sezon.ad}` : ''}
            </h2>
            {sezonListesi.length > 1 && sezon && (
              <form className="flex items-end gap-2">
                <div>
                  <label className="etiket text-xs" htmlFor="sezon">
                    Sezon
                  </label>
                  <select
                    id="sezon"
                    name="sezon"
                    defaultValue={sezon.id}
                    className="girdi !py-1.5"
                  >
                    {sezonListesi.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ad}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn-ikincil !py-1.5">Göster</button>
              </form>
            )}
          </div>
          {sezon ? (
            <TaksitBolumu
              key={sezon.id}
              studentId={id}
              sezonId={sezon.id}
              sezonAdi={sezon.ad}
              satirlar={taksitSatirlari}
            />
          ) : (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Sezon tanımlı değil. Ayarlar sayfasından sezon eklemeden taksit planı
              görüntülenemez.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* İşlem geçmişi */}
        <div className="kart overflow-x-auto">
          <div className="flex items-center justify-between border-b border-cizgi px-4 py-3">
            <h2 className="font-semibold">İşlem Geçmişi</h2>
            <Link
              href={`/payments/new?student=${id}`}
              className="text-sm text-vurgu hover:underline"
            >
              + İşlem ekle
            </Link>
          </div>
          <table className="tablo">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>Açıklama</th>
                <th className="text-right">Tutar</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {islemler.map((i) => (
                <IslemSatiri key={i.id} islem={i} />
              ))}
              {islemler.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-solgun">
                    Henüz işlem yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-5">
          {/* Ücret & iskonto */}
          <div className="kart p-4">
            <h2 className="mb-3 font-semibold">Ücret Ayarı</h2>
            <p className="mb-3 text-sm text-solgun">
              Günlük efektif ücret:{' '}
              <strong className="text-metin">{para(ozet.gunluk_ucret)}</strong>
              {ozet.abone_tipi === 'aylik' && (
                <span className="mt-1 block text-xs">
                  Aylıkçı olduğu için yemek başına ücret düşmez.
                </span>
              )}
            </p>
            <IskontoFormu
              id={id}
              iskontoOrani={Number(ozet.iskonto_orani)}
              iskontoTutar={Number(ozet.iskonto_tutar)}
              devir={Number(ozet.devir)}
            />
          </div>

          {/* Veli bilgisi */}
          <div className="kart p-4">
            <h2 className="mb-3 font-semibold">Veli Bilgisi</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-solgun">Veli</dt>
                <dd className="text-right">{ozet.veli_adi ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-solgun">Telefon</dt>
                <dd className="text-right">
                  {ozet.veli_telefon ? (
                    <a href={`tel:${ozet.veli_telefon}`} className="text-vurgu hover:underline">
                      {ozet.veli_telefon}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-solgun">Kimlik / Kart No</dt>
                <dd className="text-right tabular-nums">{ozet.kimlik_no ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-solgun">Toplam öğün</dt>
                <dd className="text-right tabular-nums">{ozet.ogun_sayisi}</dd>
              </div>
            </dl>
            <Link
              href={`/reports/devam/${id}`}
              className="mt-3 inline-block text-sm text-vurgu hover:underline"
            >
              Devam takvimini gör →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function OzetKart({
  baslik,
  deger,
  renk,
}: {
  baslik: string
  deger: string
  renk?: string
}) {
  return (
    <div className="kart p-4">
      <p className="text-xs font-medium tracking-wide text-solgun uppercase">{baslik}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${renk ?? ''}`}>{deger}</p>
    </div>
  )
}
