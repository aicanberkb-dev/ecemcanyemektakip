import Link from 'next/link'
import { redirect } from 'next/navigation'

import { UstMenu } from '@/components/UstMenu'
import { aktifOkul, genelModu, GENEL, okullar } from '@/lib/okul'
import { oturumBilgisi } from '@/lib/yetki'

export default async function UygulamaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const oturum = await oturumBilgisi()
  if (!oturum) redirect('/login')

  const [liste, aktif, genel] = await Promise.all([okullar(), aktifOkul(), genelModu()])

  // Hiç okul tanımlı değilse sayfalar anlamsız veri gösterir; erken uyar.
  // Genel modda okul zaten seçili olmaz, bu uyarı geçerli değil.
  if (!aktif && !genel) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
        <div className="kart p-6 text-center">
          <h1 className="baslik mb-2">Okul tanımlı değil</h1>
          <p className="text-sm text-solgun">
            Sistemin çalışması için en az bir okul gerekiyor.
          </p>
          <Link href="/admin/settings" className="btn-birincil mt-4">
            Ayarlara git
          </Link>
        </div>
      </main>
    )
  }

  return (
    <>
      <UstMenu
        kullanici={oturum.adSoyad ?? oturum.email ?? ''}
        okullar={liste}
        aktifOkulId={genel ? GENEL : aktif!.id}
        genel={genel}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  )
}
