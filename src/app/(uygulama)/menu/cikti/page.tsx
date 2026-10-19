import Link from 'next/link'

import { YazdirButonu } from '@/components/Yazdir'
import { AY_ADLARI } from '@/lib/format'
import { listeKapaliGunleri } from '@/lib/okulsuz'
import { supabaseServer } from '@/lib/supabase/server'

import { AfisIndir } from './AfisIndir'
import { kuralliKapaliGunler, sabitKapaliKurali } from '../sabit-kapali'

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
  searchParams: Promise<{
    liste?: string
    yil?: string
    ay?: string
    tur?: string
    bas?: string
    bit?: string
  }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1
  const tur: AfisTuru = q.tur === 'cikti' ? 'cikti' : 'afis'

  // Serbest tarih aralığı: iki tarih de doluysa ay yerine o aralık basılır.
  // Ay görünümü varsayılan kalıyor, aralık yalnız istendiğinde devreye girer.
  const gecerliTarih = (t?: string) => !!t && /^\d{4}-\d{2}-\d{2}$/.test(t)
  const aralikli = gecerliTarih(q.bas) && gecerliTarih(q.bit) && q.bas! <= q.bit!

  const supabase = await supabaseServer()

  const { data: listeler } = await supabase
    .from('menu_listeleri')
    .select('id, ad, havuz_grubu, satir_sayisi, afis_basligi, kapali_haftagunu, kapali_notu')
    .eq('aktif', true)
    .order('sira')

  const liste = (listeler ?? []).find((l) => l.id === q.liste) ?? (listeler ?? [])[0]
  if (!liste) return null

  const bas = aralikli ? q.bas! : `${yil}-${String(ay).padStart(2, '0')}-01`
  const bit = aralikli
    ? q.bit!
    : `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`

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
  // Gerçek kapalı günler + listenin sabit kapalı gün kuralı (etüt yemeği
  // cumaları yok). Kural yalnız alanı dolu listeleri etkiliyor.
  const kapali = kuralliKapaliGunler(
    bas,
    bit,
    sabitKapaliKurali(liste),
    new Map(okulsuzVeri.map((o) => [o.tarih, o.sebep?.trim() || null])),
  )
  const gunler = afisGunleri((data ?? []) as AfisGunu[], kapali)
  const dortSatir = (liste.satir_sayisi ?? 4) >= 4

  // Serbest aralıkta afişin başlığında ay adı yazmıyor; onun yerine seçilen
  // tarih aralığı duruyor, yoksa hangi günleri kapsadığı belirsiz kalıyor.
  const gunNokta = (t: string) => t.slice(8, 10) + '.' + t.slice(5, 7) + '.' + t.slice(0, 4)
  const donemYazi = aralikli ? `${gunNokta(bas)} – ${gunNokta(bit)}` : null

  const aralikEki = aralikli ? `&bas=${bas}&bit=${bit}` : ''
  const adres = (t: AfisTuru) =>
    `/menu/cikti?liste=${liste.id}&yil=${yil}&ay=${ay}&tur=${t}${aralikEki}`
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

          {/* Serbest aralık: ay yerine iki tarih arasını basmak için. GET
              formu, sonuç adrese yazılsın ki afiş bağlantısı paylaşılabilsin. */}
          <form method="get" action="/menu/cikti" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="liste" value={liste.id} />
            <input type="hidden" name="tur" value={tur} />
            <input type="hidden" name="yil" value={yil} />
            <input type="hidden" name="ay" value={ay} />
            <label className="text-xs text-solgun">
              <span className="block font-semibold">Baş. tarihi</span>
              <input
                type="date"
                name="bas"
                defaultValue={aralikli ? bas : ''}
                className="girdi mt-0.5 !py-1 text-xs"
              />
            </label>
            <label className="text-xs text-solgun">
              <span className="block font-semibold">Bitiş tarihi</span>
              <input
                type="date"
                name="bit"
                defaultValue={aralikli ? bit : ''}
                className="girdi mt-0.5 !py-1 text-xs"
              />
            </label>
            <button type="submit" className="btn-ikincil !py-1.5 text-xs">
              Getir
            </button>
            {aralikli && (
              <Link
                href={`/menu/cikti?liste=${liste.id}&yil=${yil}&ay=${ay}&tur=${tur}`}
                className="py-1.5 text-xs text-vurgu hover:underline"
              >
                Aya dön
              </Link>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-solgun">
              {liste.ad} · {gunler.length} gün
            </span>
            {tur === 'afis' ? (
              <AfisIndir
                key={`${liste.id}-${bas}-${bit}`}
                dosyaAdi={`${liste.afis_basligi ?? 'Yemek Listesi'} ${donemYazi ?? `${AY_ADLARI[ay - 1]} ${yil}`}.png`}
              >
                <MenuAfisi
                  yil={yil}
                  ay={ay}
                  gunler={gunler}
                  kapali={kapali}
                  dortSatir={dortSatir}
                  listeAdi={liste.afis_basligi}
                  donemYazi={donemYazi}
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
          {donemYazi ?? `${AY_ADLARI[ay - 1]} ${yil}`} için <strong>{liste.ad}</strong> listesinde menü yok.
        </p>
      )}

      <div className={`${KAGIT_SINIFI} mx-auto w-full max-w-[794px] shadow-lg`}>
        <MenuAfisi
          yil={yil}
          ay={ay}
          gunler={gunler}
          kapali={kapali}
          dortSatir={dortSatir}
          listeAdi={liste.afis_basligi}
          donemYazi={donemYazi}
          tur={tur}
        />
      </div>
    </div>
  )
}
