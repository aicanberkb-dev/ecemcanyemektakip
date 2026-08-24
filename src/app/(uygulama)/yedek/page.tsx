import { supabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Yedek — Yemek Takip' }

/**
 * Veri yedeği ekranı.
 *
 * Veri yalnızca Supabase'de duruyor. Ücretsiz planda geri yüklenebilir bir
 * yedek yok ve proje uzun süre kullanılmazsa duraklatılıyor; bu yüzden elde
 * bir kopya bulundurmak gerekiyor.
 */
export default async function YedekPage() {
  const supabase = await supabaseServer()

  const [{ count: ogrenci }, { count: tahsilat }, { count: ogun }, { count: menu }] =
    await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tip', 'tahsilat'),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .not('ogun_abone_tipi', 'is', null),
      supabase.from('menu_gunleri').select('*', { count: 'exact', head: true }),
    ])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="baslik">Veri Yedeği</h1>
        <p className="text-sm text-solgun">
          Tüm veritabanını tek dosya olarak bilgisayarınıza indirir. Sistem
          kullanılamaz hâle gelirse bu dosya elinizde kalır.
        </p>
      </div>

      <div className="kart p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Sayac ad="Öğrenci" deger={ogrenci ?? 0} />
          <Sayac ad="Tahsilat" deger={tahsilat ?? 0} />
          <Sayac ad="Öğün kaydı" deger={ogun ?? 0} />
          <Sayac ad="Menü günü" deger={menu ?? 0} />
        </div>

        <a
          href="/api/yedek"
          download
          className="btn-birincil mt-6 inline-block !px-6 !py-3 text-base"
        >
          Yedeği indir (.json)
        </a>

        <p className="mt-3 text-xs text-solgun">
          Dosyada öğrenciler, tahsilatlar, öğün kayıtları, menüler, reçeteler,
          maliyet ve finans tabloları — 27 tablonun tamamı ham hâliyle bulunur.
          İnmesi birkaç saniye sürebilir.
        </p>
      </div>

      <div className="kart space-y-3 p-6 text-sm">
        <h2 className="font-semibold">Bu dosyayı nerede saklamalı</h2>
        <p className="text-solgun">
          İndirdiğiniz dosyayı bilgisayarınızın dışında bir yerde de tutun —
          OneDrive, e-posta ya da harici disk. Aynı bilgisayarda durursa
          bilgisayar bozulduğunda yedek de gider.
        </p>
        <h2 className="pt-2 font-semibold">Ne zaman almalı</h2>
        <p className="text-solgun">
          Ayda bir yeterli; yoğun tahsilat dönemlerinde haftada bir. Sezon
          başında ve sezon sonunda mutlaka.
        </p>
        <h2 className="pt-2 font-semibold">Geri yükleme</h2>
        <p className="text-solgun">
          Dosya ham tablo verisi içerir; yeni bir kuruluma aynı tablo adlarıyla
          basılabilir. Veritabanı şeması <code>supabase/migrations</code>{' '}
          klasöründe ve GitHub&apos;da duruyor, yani şema + bu dosya = sistemin
          tamamı.
        </p>
      </div>
    </div>
  )
}

function Sayac({ ad, deger }: { ad: string; deger: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{deger}</p>
      <p className="text-xs text-solgun">{ad}</p>
    </div>
  )
}
