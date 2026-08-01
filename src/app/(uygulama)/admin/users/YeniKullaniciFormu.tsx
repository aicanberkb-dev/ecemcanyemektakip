'use client'

import { useActionState, useState } from 'react'

import { kullaniciEkle, type KullaniciDurumu } from './actions'

export function YeniKullaniciFormu() {
  const [acik, setAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(kullaniciEkle, {} as KullaniciDurumu)

  if (!acik) {
    return (
      <button type="button" onClick={() => setAcik(true)} className="btn-birincil">
        + Yeni Kullanıcı
      </button>
    )
  }

  return (
    <form action={gonder} className="kart w-full space-y-4 p-5">
      <h2 className="font-semibold">Yeni Kullanıcı</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiket" htmlFor="ad_soyad">
            Ad Soyad *
          </label>
          <input id="ad_soyad" name="ad_soyad" className="girdi" required />
          {durum.alanlar?.ad_soyad && <p className="hata">{durum.alanlar.ad_soyad}</p>}
        </div>

        <div>
          <label className="etiket" htmlFor="email">
            E-posta *
          </label>
          <input id="email" type="email" name="email" className="girdi" required />
          {durum.alanlar?.email && <p className="hata">{durum.alanlar.email}</p>}
        </div>

        <div>
          <label className="etiket" htmlFor="sifre">
            Şifre * (en az 8 karakter)
          </label>
          <input
            id="sifre"
            type="password"
            name="sifre"
            autoComplete="new-password"
            className="girdi"
            required
          />
          {durum.alanlar?.sifre && <p className="hata">{durum.alanlar.sifre}</p>}
        </div>

        <div>
          <label className="etiket" htmlFor="rol">
            Rol
          </label>
          <select id="rol" name="rol" defaultValue="personel" className="girdi">
            <option value="personel">Personel</option>
            <option value="admin">Admin</option>
          </select>
          <p className="mt-1 text-xs text-solgun">
            Rol ayrımı şu an kapalı — giriş yapan herkes her şeyi yapabilir.
          </p>
        </div>
      </div>

      {durum.hata && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{durum.hata}</p>
      )}
      {durum.basari && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {durum.basari}
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn-birincil" disabled={bekliyor}>
          {bekliyor ? 'Ekleniyor…' : 'Kullanıcı Ekle'}
        </button>
        <button type="button" onClick={() => setAcik(false)} className="btn-ikincil">
          Kapat
        </button>
      </div>
    </form>
  )
}
