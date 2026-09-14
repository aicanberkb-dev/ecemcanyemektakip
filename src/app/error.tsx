'use client' // Hata sınırları istemci bileşeni olmak zorunda

import { useEffect } from 'react'

/**
 * Sayfa yüklenirken veritabanına ulaşılamazsa gösterilir.
 *
 * Veritabanına giden yolda ara ara kısa kopmalar oluyor; okuma istekleri
 * zaten birkaç kez tekrar deneniyor (dayanikli-fetch). Yine de düşerse
 * yanıltıcı bir ekran ("okul tanımlı değil") yerine bu sayfa çıkar ve tek
 * tıkla yeniden denenir.
 */
export default function Hata({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16">
      <div className="kart p-6 text-center">
        <h1 className="baslik mb-2">Bağlantı kurulamadı</h1>
        <p className="text-sm text-solgun">
          Sisteme şu an ulaşılamadı. Birkaç saniye sonra tekrar deneyin; kaydettiğiniz
          işlemler yerinde, yalnız kaydetmeden bıraktığınız bir form varsa onu yeniden
          girmeniz gerekebilir.
        </p>
        <button type="button" onClick={() => unstable_retry()} className="btn-birincil mt-4">
          Tekrar dene
        </button>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">Hata kodu: {error.digest}</p>
        )}
      </div>
    </main>
  )
}
