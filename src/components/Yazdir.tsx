'use client'

/** Tarayıcının yazdırma penceresini açar. */
export function YazdirButonu({ etiket = 'Yazdır' }: { etiket?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ikincil yazdirma-gizle">
      {etiket}
    </button>
  )
}
