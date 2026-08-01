'use client'

import { useActionState, useState } from 'react'

import { tarihSaat } from '@/lib/format'
import type { KullaniciRolu } from '@/lib/types'

import { kullaniciSil, rolGuncelle, sifreSifirla, type KullaniciDurumu } from './actions'

export type KullaniciSatir = {
  id: string
  email: string
  adSoyad: string
  rol: KullaniciRolu
  sonGiris: string | null
  olusturma: string
}

export function KullaniciSatiri({
  kullanici,
  kendisiMi,
}: {
  kullanici: KullaniciSatir
  kendisiMi: boolean
}) {
  const [mod, setMod] = useState<'goster' | 'duzenle' | 'sifre'>('goster')

  const rolEylem = rolGuncelle.bind(null, kullanici.id)
  const [rolDurum, rolGonder, rolBekliyor] = useActionState(rolEylem, {} as KullaniciDurumu)

  const sifreEylem = sifreSifirla.bind(null, kullanici.id)
  const [sifreDurum, sifreGonder, sifreBekliyor] = useActionState(
    sifreEylem,
    {} as KullaniciDurumu,
  )

  if (rolDurum.basari && mod === 'duzenle') setMod('goster')

  if (mod === 'duzenle') {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={6} className="px-3 py-3">
          <form action={rolGonder} className="flex flex-wrap items-end gap-3">
            <div className="min-w-40 flex-1">
              <label className="etiket text-xs">Ad Soyad</label>
              <input name="ad_soyad" defaultValue={kullanici.adSoyad} className="girdi !py-1.5" />
            </div>
            <div>
              <label className="etiket text-xs">Rol</label>
              <select name="rol" defaultValue={kullanici.rol} className="girdi !py-1.5">
                <option value="personel">Personel</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="btn-birincil !py-1.5" disabled={rolBekliyor}>
              Kaydet
            </button>
            <button type="button" onClick={() => setMod('goster')} className="btn-ikincil !py-1.5">
              Vazgeç
            </button>
            {rolDurum.hata && <p className="hata w-full">{rolDurum.hata}</p>}
          </form>
        </td>
      </tr>
    )
  }

  if (mod === 'sifre') {
    return (
      <tr className="bg-amber-50/50">
        <td colSpan={6} className="px-3 py-3">
          <form action={sifreGonder} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label className="etiket text-xs">
                {kullanici.email} için yeni şifre
              </label>
              <input
                type="password"
                name="sifre"
                autoComplete="new-password"
                className="girdi !py-1.5"
              />
              {sifreDurum.alanlar?.sifre && <p className="hata">{sifreDurum.alanlar.sifre}</p>}
            </div>
            <button className="btn-birincil !py-1.5" disabled={sifreBekliyor}>
              Şifreyi Değiştir
            </button>
            <button type="button" onClick={() => setMod('goster')} className="btn-ikincil !py-1.5">
              Vazgeç
            </button>
            {sifreDurum.hata && <p className="hata w-full">{sifreDurum.hata}</p>}
            {sifreDurum.basari && (
              <p className="w-full text-sm text-emerald-700">{sifreDurum.basari}</p>
            )}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="font-medium">
        {kullanici.adSoyad}
        {kendisiMi && <span className="ml-2 rozet bg-blue-100 text-blue-800">siz</span>}
      </td>
      <td className="text-solgun">{kullanici.email}</td>
      <td>
        {kullanici.rol === 'admin' ? (
          <span className="rozet bg-purple-100 text-purple-800">Admin</span>
        ) : (
          <span className="rozet bg-slate-100 text-slate-700">Personel</span>
        )}
      </td>
      <td className="whitespace-nowrap text-solgun">{tarihSaat(kullanici.sonGiris)}</td>
      <td className="whitespace-nowrap text-solgun">{tarihSaat(kullanici.olusturma)}</td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setMod('duzenle')}
          className="text-xs text-vurgu hover:underline"
        >
          Düzelt
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          onClick={() => setMod('sifre')}
          className="text-xs text-vurgu hover:underline"
        >
          Şifre
        </button>
        {!kendisiMi && (
          <>
            <span className="mx-2 text-cizgi">|</span>
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`${kullanici.email} silinsin mi? Geri alınamaz.`)) return
                await kullaniciSil(kullanici.id)
              }}
              className="text-xs text-red-600 hover:underline"
            >
              Sil
            </button>
          </>
        )}
      </td>
    </tr>
  )
}
