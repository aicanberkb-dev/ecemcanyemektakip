import Link from 'next/link'

import { aktifOkul } from '@/lib/okul'
import { telefonNormalize } from '@/lib/rehber'
import { sezonSec } from '@/lib/sezon'
import { sezonlar as sezonlariGetir } from '@/lib/sezon-sunucu'
import { bugunSunucu } from '@/lib/simulasyon-sunucu'
import { supabaseServer } from '@/lib/supabase/server'
import type { StudentBalance, TaksitDurumu } from '@/lib/types'

import { MesajEkrani, type MesajSatiri } from './MesajEkrani'

export const metadata = { title: 'Veli Mesajları — Yemek Takip' }

/**
 * Velilere WhatsApp üzerinden sıralı mesaj gönderme.
 *
 * Toplu gönderim yapan bir servis yok: her mesaj WhatsApp'ta açılıyor,
 * göndermeye kullanıcı karar veriyor. Ekranın işi doğru listeyi çıkarmak,
 * metni kişiselleştirmek ve sırayı kaybettirmemek.
 */
export default async function MesajPage() {
  const okul = await aktifOkul()
  if (!okul) return null

  const supabase = await supabaseServer()
  const bugun = await bugunSunucu()

  const sezonListesi = await sezonlariGetir(okul.id)
  const sezon = sezonSec(sezonListesi, undefined)

  const [{ data: bakiyeVeri }, { data: taksitVeri }] = await Promise.all([
    supabase
      .from('student_balances')
      .select('*')
      .eq('okul_id', okul.id)
      .eq('aktif', true)
      .order('ad_soyad'),
    sezon
      ? supabase.rpc('taksit_durumu', { p_sezon_id: sezon.id, p_tarih: bugun })
      : Promise.resolve({ data: null }),
  ])

  const ogrenciler = (bakiyeVeri ?? []) as StudentBalance[]
  const taksitler = (taksitVeri ?? []) as TaksitDurumu[]

  /** Veli adı ve telefonu: birinci veli boşsa ikinciye düşülür. */
  function veliBilgisi(o: StudentBalance) {
    const tel1 = telefonNormalize(o.veli_telefon)
    if (tel1) return { veli: o.veli_adi ?? o.veli2_adi, telefon: tel1 }
    const tel2 = telefonNormalize(o.veli2_telefon)
    if (tel2) return { veli: o.veli2_adi ?? o.veli_adi, telefon: tel2 }
    return { veli: o.veli_adi ?? o.veli2_adi, telefon: null }
  }

  function satirYap(o: StudentBalance, tutar: number | string): MesajSatiri {
    const { veli, telefon } = veliBilgisi(o)
    return {
      student_id: o.student_id,
      ogrenci: o.ad_soyad,
      sinif: o.sinif,
      veli,
      telefon,
      tutar,
    }
  }

  // Borçlu günlükçüler: aylıkçı yemek başına borçlanmaz, taksitten takip edilir
  const borc = ogrenciler
    .filter((o) => o.abone_tipi === 'gunluk' && Number(o.kalan) < 0)
    .sort((a, b) => Number(a.kalan) - Number(b.kalan))
    .map((o) => satirYap(o, Math.abs(Number(o.kalan))))

  // Taksiti geçenler: bakiye aylıkçıda bir şey söylemiyor, cevap taksit planında
  const ogrenciHaritasi = new Map(ogrenciler.map((o) => [o.student_id, o]))
  const taksit = taksitler
    .filter((t) => Number(t.eksik) > 0)
    .sort((a, b) => Number(b.eksik) - Number(a.eksik))
    .map((t) => {
      const o = ogrenciHaritasi.get(t.student_id)
      if (!o) return null
      return satirYap(o, Number(t.eksik))
    })
    .filter((s): s is MesajSatiri => s !== null)

  const duyuru = ogrenciler.map((o) =>
    satirYap(o, o.abone_tipi === 'aylik' ? 'Aylıkçı' : 'Günlükçü'),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="baslik">Veli Mesajları</h1>
        <span className="rozet bg-blue-100 text-blue-800">{okul.ad}</span>
      </div>
      <p className="text-sm text-solgun">
        Velileri seç, mesajı gözden geçir, sırayla gönder. Her mesaj WhatsApp&apos;ta
        açılır ve metin hazır gelir; <strong>göndermeye sen karar verirsin</strong>.
        Listeler{' '}
        <Link href="/reports/borclu" className="text-vurgu hover:underline">
          Borçlu Öğrenciler
        </Link>{' '}
        ve{' '}
        <Link href="/reports/taksit" className="text-vurgu hover:underline">
          Taksit Takibi
        </Link>{' '}
        ile aynı veriden gelir.
      </p>

      {!sezon && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {okul.ad} için sezon tanımlı değil; &quot;Taksiti geçenler&quot; sekmesi boş
          gelir. Sezonu{' '}
          <Link href="/admin/settings" className="underline">
            Ayarlar
          </Link>
          &apos;dan tanımlayabilirsiniz.
        </p>
      )}

      <MesajEkrani
        okulAdi={okul.ad}
        bugun={bugun}
        borc={borc}
        taksit={taksit}
        duyuru={duyuru}
      />
    </div>
  )
}
