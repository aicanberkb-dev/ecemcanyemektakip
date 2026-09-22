import { cookies } from 'next/headers'

import { supabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Oturum Durumu — Yemek Takip' }

/**
 * Teşhis sayfası: giriş yapıldıktan sonra oturum çerezi sunucuya ulaşıyor mu?
 *
 * Telefonda "giriş yapıyorum ama sayfa giriş ekranına dönüyor" şikâyetinde,
 * sorunun çerezde mi yoksa uygulamada mı olduğunu ayırt eder. Değer değil,
 * yalnız çerezin var olup olmadığı gösterilir.
 */
export default async function OturumDurumu() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.getUser()

  const cerezler = (await cookies()).getAll()
  const authCerezleri = cerezler.filter((c) => c.name.startsWith('sb-'))

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="baslik">Oturum Durumu</h1>

      <div className="kart space-y-2 p-4">
        <p className="text-sm">
          Sunucu oturumu:{' '}
          {data.user ? (
            <strong className="text-emerald-700">VAR</strong>
          ) : (
            <strong className="text-red-700">YOK</strong>
          )}
        </p>
        {data.user && <p className="text-sm text-solgun">Kullanıcı: {data.user.email}</p>}
        {error && <p className="text-sm text-red-700">Hata: {error.message}</p>}
        <p className="text-sm">
          Oturum çerezi: <strong>{authCerezleri.length}</strong> parça
          {authCerezleri.length > 0 && (
            <span className="text-solgun"> ({authCerezleri.map((c) => c.name).join(', ')})</span>
          )}
        </p>
        <p className="text-sm">
          Toplam çerez: <strong>{cerezler.length}</strong>
        </p>
      </div>

      <p className="text-xs text-solgun">
        Giriş yaptıktan hemen sonra bu sayfayı açın. &quot;Oturum: VAR&quot; yazıyorsa çerez
        çalışıyor, sorun uygulamadadır. &quot;YOK&quot; ve çerez sayısı 0 ise tarayıcı çerezi
        saklamıyordur.
      </p>
    </main>
  )
}
