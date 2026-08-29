import { CiktiBasligi } from '@/components/CiktiBasligi'
import { YazdirButonu } from '@/components/Yazdir'
import { CARI_GRUPLARI } from '@/lib/cari-gruplari'
import { AY_ADLARI, para } from '@/lib/format'
import { supabaseServer } from '@/lib/supabase/server'

import { GecmisAlacaklar, type GecmisSatir } from './GecmisAlacaklar'

export const metadata = { title: 'Tahsil Edilmemiş — Yemek Takip' }

type Cari = { id: string; ad: string; grup: string; sira: number }
type Fatura = {
  id: string
  cari_id: string
  donem_yil: number
  donem_ay: number
  adet: number | null
  tutar: number | string
  kapatildi: string | null
}
type Tahsilat = { fatura_id: string; tutar: number | string }

/**
 * Geçmiş ayların tahsil edilmemiş faturaları.
 *
 * Alacaklar ekranı tek aya bakıyor; ay değişince eski ayın kapanmamış
 * faturası gözden kaçıyordu. Bu rapor bugünün ayından önceki bütün dönemleri
 * tarar ve yalnızca kapanmamış olanları gösterir.
 */
export default async function TahsilEdilmemisPage({
  searchParams,
}: {
  searchParams: Promise<{ hepsi?: string }>
}) {
  const q = await searchParams
  const hepsi = q.hepsi === '1'

  const simdi = new Date()
  const yil = simdi.getFullYear()
  const ay = simdi.getMonth() + 1
  // Bu ay henüz tahsil edilmemiş olması normal; rapor geçmiş aylara bakar.
  const sinir = yil * 12 + ay

  const supabase = await supabaseServer()

  const [{ data: cariVeri }, { data: faturaVeri }] = await Promise.all([
    supabase.from('cariler').select('id, ad, grup, sira'),
    supabase
      .from('faturalar')
      .select('id, cari_id, donem_yil, donem_ay, adet, tutar, kapatildi')
      .order('donem_yil')
      .order('donem_ay'),
  ])

  const cariler = (cariVeri ?? []) as Cari[]
  const tumFaturalar = (faturaVeri ?? []) as Fatura[]

  const gecmis = tumFaturalar.filter(
    (f) => f.donem_yil * 12 + f.donem_ay < sinir && (hepsi || !f.kapatildi),
  )

  const { data: tahsilatVeri } = gecmis.length
    ? await supabase
        .from('fatura_tahsilatlari')
        .select('fatura_id, tutar')
        .in(
          'fatura_id',
          gecmis.map((f) => f.id),
        )
    : { data: null }

  const tahsilatlar = (tahsilatVeri ?? []) as Tahsilat[]

  const satirlar: GecmisSatir[] = gecmis
    .map((f) => {
      const cari = cariler.find((c) => c.id === f.cari_id)
      const tahsil = tahsilatlar
        .filter((t) => t.fatura_id === f.id)
        .reduce((t, x) => t + Number(x.tutar), 0)
      return {
        id: f.id,
        cariAdi: cari?.ad ?? '—',
        grup: cari?.grup ?? 'diger',
        cariSira: cari?.sira ?? 99,
        donem: `${f.donem_yil}-${String(f.donem_ay).padStart(2, '0')}`,
        donemAdi: `${AY_ADLARI[f.donem_ay - 1]} ${f.donem_yil}`,
        adet: f.adet,
        tutar: Number(f.tutar),
        tahsil,
        kalan: f.kapatildi ? 0 : Number(f.tutar) - tahsil,
        kapatildi: f.kapatildi,
      }
    })
    // Kapanmış (kalan sıfır) faturalar takipte yer kaplamasın
    .filter((s) => hepsi || s.kalan > 0.005)

  const toplamKalan = satirlar.reduce((t, s) => t + s.kalan, 0)

  return (
    <div className="space-y-4">
      <CiktiBasligi
        baslik="Tahsil Edilmemiş Faturalar"
        okul="Ecem Can Yemekhane Hizmetleri"
        donem={`${AY_ADLARI[ay - 1]} ${yil} öncesi`}
      />

      <div className="yazdirma-gizle flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">Tahsil Edilmemiş Faturalar</h1>
          <p className="text-sm text-solgun">
            {AY_ADLARI[ay - 1]} {yil} <strong>öncesine</strong> ait, hâlâ kapanmamış
            faturalar. Para birebir tutmayabilir — havale kesintisi, birleşik ödeme,
            yuvarlama. <strong>Ödendi</strong> düğmesi faturayı takipten düşürür; girilen
            tahsilat tutarı olduğu gibi kalır, aradaki fark gizlenmez.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <a
            href={hepsi ? '/finans/tahsil-edilmemis' : '/finans/tahsil-edilmemis?hepsi=1'}
            className="btn-ikincil"
          >
            {hepsi ? 'Yalnızca açıklar' : 'Kapananları da göster'}
          </a>
          <YazdirButonu />
        </div>
      </div>

      <div className="kart p-4">
        <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
          Toplam tahsil edilmemiş
        </p>
        <p
          className={`mt-1 text-3xl font-bold tabular-nums ${
            toplamKalan > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {para(toplamKalan)}
        </p>
        <p className="mt-1 text-sm text-solgun">
          {satirlar.filter((s) => s.kalan > 0.005).length} fatura
        </p>
      </div>

      <GecmisAlacaklar satirlar={satirlar} gruplar={[...CARI_GRUPLARI]} />
    </div>
  )
}
