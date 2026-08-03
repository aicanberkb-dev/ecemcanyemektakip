import { tarihSaat } from '@/lib/format'

/**
 * Yalnızca kâğıtta görünen başlık. Çıktı elden ele dolaştığı için hangi
 * okula, hangi döneme ve ne zaman ait olduğu üstünde yazılı olmalı.
 */
export function CiktiBasligi({
  baslik,
  okul,
  donem,
}: {
  baslik: string
  okul: string
  donem?: string
}) {
  return (
    <div className="yazdirma-basligi mb-4 border-b border-slate-400 pb-2">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-bold">{baslik}</h1>
        <span className="text-sm font-semibold">{okul}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-600">
        {donem ? `${donem} · ` : ''}
        Döküm tarihi: {tarihSaat(new Date())}
      </p>
    </div>
  )
}
