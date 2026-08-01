import { GirisFormu } from './GirisFormu'

export const metadata = { title: 'Giriş — Yemek Takip' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>
}) {
  const { devam } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="kart w-full max-w-sm p-8">
        <h1 className="mb-1 text-2xl font-bold text-vurgu">Yemek Takip</h1>
        <p className="mb-6 text-sm text-solgun">Devam etmek için giriş yapın.</p>
        <GirisFormu devam={devam ?? '/pos'} />
      </div>
    </main>
  )
}
