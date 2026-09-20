import Link from 'next/link'

/**
 * Okula bağlı kullanıcı, kendisine kapalı bir ekranın adresini elle yazarsa
 * bunu görür. Menüde zaten bağlantı yok; bu ikinci kapı.
 */
export function YetkiYok({ ekran }: { ekran: string }) {
  return (
    <div className="kart mx-auto max-w-md p-6 text-center">
      <h1 className="baslik mb-2">Yetkiniz yok</h1>
      <p className="text-sm text-solgun">
        {ekran} ekranı hesabınıza kapalı. Hesabınız tek bir okulun günlük
        işlerine tanımlı.
      </p>
      <Link href="/pos" className="btn-birincil mt-4">
        Yemekhane ekranına dön
      </Link>
    </div>
  )
}
