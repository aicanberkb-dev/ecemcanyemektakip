'use client'

import { useState } from 'react'

/**
 * Kasaya elle para giriş/çıkış butonu.
 *
 * Tutar boş (0) başlar: kaydedilecek rakamı her seferinde kullanıcı yazar,
 * yanlışlıkla önceki tutarın tekrar girilmesi engellenir. Açıklama isteğe
 * bağlı ama ay sonunda "bu para neydi" sorusunun tek cevabı orası.
 *
 * Yemekhane ve toplu giriş ekranlarının ikisinde de aynı kutu duruyor;
 * biri değişince diğeri farklı davranmasın diye tek yerde.
 */
export function KasaButonu({
  children,
  renk,
  etkin,
  /** Butonu kısaltır: toplu giriş ekranında dev buton gerekmiyor */
  kucuk,
  onGonder,
}: {
  children: React.ReactNode
  renk: string
  etkin: boolean
  kucuk?: boolean
  onGonder: (tutar: number, aciklama: string) => void
}) {
  const [tutar, setTutar] = useState('0')
  const [aciklama, setAciklama] = useState('')
  const [uyari, setUyari] = useState(false)

  // Türkçe virgüllü giriş kabul edilir
  const sayi = Number(tutar.replace(/\./g, '').replace(',', '.'))
  const gecerli = tutar.trim() !== '' && Number.isFinite(sayi) && sayi > 0

  // Buton tutar yazılmadan da renkli durur: sönük bir buton "bozuk" gibi
  // görünüyordu. Tutar yoksa basınca uyarı çıkar.
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!etkin}
        onClick={() => {
          if (!gecerli) {
            setUyari(true)
            return
          }
          setUyari(false)
          onGonder(sayi, aciklama)
        }}
        className={`rounded-lg px-3 font-semibold whitespace-nowrap text-white transition
          ${kucuk ? 'py-3 text-sm' : 'py-9 text-lg'}
          disabled:cursor-not-allowed disabled:bg-slate-300 ${renk}`}
      >
        {children}
      </button>
      {/* Açıklama kutusu kalan bütün genişliği alır: "bu para neydi"
          sorusunun tek cevabı orası, dar bir kutuya sığmıyor. */}
      <div className="flex items-center gap-2">
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-solgun">
          <span>Tutar ₺</span>
          <input
            inputMode="decimal"
            value={tutar}
            onChange={(e) => {
              setTutar(e.target.value)
              setUyari(false)
            }}
            onFocus={(e) => e.target.select()}
            className={`w-24 rounded border bg-white px-2 py-1 text-center text-sm font-medium
                        tabular-nums outline-none focus:ring-2 focus:ring-blue-100
                        ${uyari ? 'border-red-400 text-red-700' : 'border-cizgi text-metin'}`}
          />
        </label>
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-solgun">
          <span className="shrink-0">Açıklama</span>
          <input
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="ör. bozuk para takviyesi"
            className="w-full rounded border border-cizgi bg-white px-2 py-1 text-sm
                       text-metin outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>
      {uyari && <p className="text-xs text-red-600">Önce sıfırdan büyük bir tutar yazın.</p>}
    </div>
  )
}

/**
 * Bir günün kasa hareketleri listesi; her satırın ters işlemi yanında.
 */
export function KasaListesi({
  hareketler,
  bekliyor,
  onSil,
  paraBicim,
}: {
  hareketler: { id: string; yon: 'giris' | 'cikis'; tutar: number; aciklama: string | null }[]
  bekliyor: boolean
  onSil: (hareket: {
    id: string
    yon: 'giris' | 'cikis'
    tutar: number
    aciklama: string | null
  }) => void
  /** Tutar biçimlendirici — çağıran ekranın para yardımcısı */
  paraBicim: (n: number) => string
}) {
  if (hareketler.length === 0) return null

  return (
    <ul className="mt-3 space-y-1 rounded-lg border border-cizgi bg-slate-50/70 p-3 text-sm">
      {hareketler.map((h) => (
        <li key={h.id} className="flex flex-wrap items-center gap-2">
          <span
            className={`rozet ${
              h.yon === 'giris'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {h.yon === 'giris' ? 'Kasaya giriş' : 'Kasadan çıkış'}
          </span>
          <span className="font-semibold tabular-nums">{paraBicim(h.tutar)}</span>
          <span className="text-solgun">{h.aciklama ?? '—'}</span>
          <button
            type="button"
            disabled={bekliyor}
            onClick={() => onSil(h)}
            className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Geri al
          </button>
        </li>
      ))}
    </ul>
  )
}
