import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'
import { ROL_AYRIMI_AKTIF, adminMi, oturumBilgisi } from '@/lib/yetki'

import { KullaniciSatiri, type KullaniciSatir } from './KullaniciSatiri'
import { YeniKullaniciFormu } from './YeniKullaniciFormu'

export const metadata = { title: 'Kullanıcılar — Yemek Takip' }

export default async function UsersPage() {
  const oturum = await oturumBilgisi()

  // service_role kullanmadan önce çağıranın yetkisi doğrulanır
  if (!adminMi(oturum)) {
    return (
      <p className="kart p-6 text-center text-solgun">
        Bu sayfayı görüntüleme yetkiniz yok.
      </p>
    )
  }

  const admin = supabaseAdmin()
  const supabase = await supabaseServer()

  const [{ data: authVeri, error }, { data: profilVeri }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    supabase.from('profiles').select('*'),
  ])

  const profiller = new Map(
    ((profilVeri ?? []) as Profile[]).map((p) => [p.id, p]),
  )

  const kullanicilar: KullaniciSatir[] = (authVeri?.users ?? []).map((u) => {
    const profil = profiller.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '—',
      adSoyad:
        profil?.ad_soyad ??
        (u.user_metadata?.ad_soyad as string | undefined) ??
        u.email ??
        '—',
      rol: profil?.rol ?? 'personel',
      sonGiris: u.last_sign_in_at ?? null,
      olusturma: u.created_at,
    }
  })

  kullanicilar.sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr'))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="baslik">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-solgun">
            {ROL_AYRIMI_AKTIF
              ? 'Rol ayrımı aktif — admin ve personel farklı yetkilere sahip.'
              : 'Rol ayrımı kapalı — giriş yapan herkes her şeyi yapabilir. Rol bilgisi ileride kullanılmak üzere saklanıyor.'}
          </p>
        </div>
        <YeniKullaniciFormu />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      )}

      <div className="kart overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Rol</th>
              <th>Son Giriş</th>
              <th>Kayıt</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {kullanicilar.map((k) => (
              <KullaniciSatiri
                key={k.id}
                kullanici={k}
                kendisiMi={k.id === oturum?.userId}
              />
            ))}
            {kullanicilar.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-solgun">
                  Kullanıcı bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
