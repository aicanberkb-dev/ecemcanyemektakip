import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI } from '@/lib/format'
import { listeKapaliGunleri } from '@/lib/okulsuz'
import { supabaseServer } from '@/lib/supabase/server'

import { AfisIndir } from './AfisIndir'
import { afisGunleri, KAGIT_SINIFI, MenuAfisi, type AfisGunu, type AfisTuru } from './MenuAfisi'

export const metadata = { title: 'Yemek Listesi Çıktısı — Yemek Takip' }

/**
 * Aylık yemek listesi — iki biçim, aynı düzen:
 *   Renkli afiş: velilere telefondan gönderilen görsel (PNG indir / paylaş).
 *   Siyah-beyaz çıktı: yazıcıdan basılan kâğıt; renkli afiş siyah-beyaz
 *   yazıcıda sarı bant soluk griye dönüyordu.
 *
 * Veri buradan çekilir, çizim MenuAfisi'nde.
 */
export default async function MenuCiktiPage({
  searchParams,
}: {
  searchParams: Promise<{ liste?: string; yil?: string; ay?: string; tur?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1
  const tur: AfisTuru = q.tur === 'cikti' ? 'cikti' : 'afis'

  const supabase = await supabaseServer()

  const { data: listeler } = await supabase
    .from('menu_listeleri')
    .select('id, ad, havuz_grubu, satir_sayisi')
    .eq('aktif', true)
    .order('sira')

  const liste = (listeler ?? []).find((l) => l.id === q.liste) ?? (listeler ?? [])[0]
  if (!liste) return null

  const bas = `${yil}-${String(ay).padStart(2, '0')}-01`
  const bit = `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`

  const [{ data }, okulsuzVeri] = await Promise.all([
    supabase
      .from('menu_gunleri')
      .select('tarih, corba, ana_yemek, yardimci, ek')
      .eq('liste_id', liste.id)
      .gte('tarih', bas)
      .lte('tarih', bit)
      .order('tarih'),
    // Bu menünün kapalı günleri: başka okulun kapalı günü bu afişe düşmez
    listeKapaliGunleri(supabase, liste.id, bas, bit),
  ])

  // tarih → menü ekranında o güne girilen açıklama; afişte kartın içinde yazar
  const kapali = new Map(okulsuzVeri.map((o) => [o.tarih, o.sebep?.trim() || null]))
  const gunler = afisGunleri((data ?? []) as AfisGunu[], kapali)
  const dortSatir = (liste.satir_sayisi ?? 4) >= 4

  const adres = (t: AfisTuru) => `/menu/cikti?liste=${liste.id}&yil=${yil}&ay=${ay}&tur=${t}`
  const SEKMELER: { tur: AfisTuru; ad: string; tarif: string }[] = [
    { tur: 'afis', ad: 'Renkli Afiş', tarif: 'Telefondan velilere göndermek için' },
    { tur: 'cikti', ad: 'Siyah-Beyaz Çıktı', tarif: 'Yazıcıdan basmak için' },
  ]

  return (
    <div className="space-y-4">
      {/*
        Kâğıdın kenar boşluğu sıfır: tarayıcı oraya tarih, saat ve site adresi
        basıyordu. Kenar payını afişin kendi dolgusu veriyor. Kural yalnızca
        bu sayfada geçerli.
      */}
      <style>{`@page { size: A4 portrait; margin: 0; }`}</style>

      <div className="yazdirma-gizle space-y-3">
        <Link
          href={`/menu?liste=${liste.id}&yil=${yil}&ay=${ay}`}
          className="text-sm text-vurgu hover:underline"
        >
          ← Yemek listesine dön
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-2" aria-label="Çıktı biçimi">
            {SEKMELER.map((s) => (
              <Link
                key={s.tur}
                href={adres(s.tur)}
                aria-current={s.tur === tur ? 'page' : undefined}
                className={`rounded-md border px-3.5 py-2 text-left leading-tight ${
                  s.tur === tur
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-cizgi bg-white hover:bg-gray-50'
                }`}
              >
                <span className="block text-sm font-semibold">{s.ad}</span>
                <span className={`block text-xs ${s.tur === tur ? 'text-gray-300' : 'text-solgun'}`}>
                  {s.tarif}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-solgun">
              {liste.ad} · {gunler.length} gün
            </span>
            {tur === 'afis' ? (
              <AfisIndir
                key={`${liste.id}-${yil}-${ay}`}
                dosyaAdi={`Yemek Listesi ${AY_ADLARI[ay - 1]} ${yil}.png`}
              >
                <MenuAfisi
                  yil={yil}
                  ay={ay}
                  gunler={gunler}
                  kapali={kapali}
                  dortSatir={dortSatir}
                  tur="afis"
                />
              </AfisIndir>
            ) : (
              <YazdirButonu etiket="Yazdır" />
            )}
          </div>
        </div>
      </div>

      {gunler.length === 0 && (
        <p className="yazdirma-gizle rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {AY_ADLARI[ay - 1]} {yil} için <strong>{liste.ad}</strong> listesinde menü yok.
        </p>
      )}

      <div className={`${KAGIT_SINIFI} mx-auto w-full max-w-[794px] shadow-lg`}>
        <MenuAfisi
          yil={yil}
          ay={ay}
          gunler={gunler}
          kapali={kapali}
          dortSatir={dortSatir}
          tur={tur}
        />
      </div>
    </div>
  )
}
