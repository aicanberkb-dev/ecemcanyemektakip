import { redirect } from 'next/navigation'

import { UstMenu } from '@/components/UstMenu'
import { oturumBilgisi } from '@/lib/yetki'

export default async function UygulamaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const oturum = await oturumBilgisi()
  if (!oturum) redirect('/login')

  return (
    <>
      <UstMenu kullanici={oturum.adSoyad ?? oturum.email ?? ''} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  )
}
