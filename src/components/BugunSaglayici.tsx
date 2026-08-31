'use client'

import { createContext, useContext } from 'react'

import { gercekBugun } from '@/lib/simulasyon'

/**
 * İstemci tarafında "bugün".
 *
 * Değer sunucudan (kök düzenden) geliyor. Çerezi doğrudan istemcide okumak
 * daha kısa olurdu ama sunucu çıktısıyla istemci çıktısı farklı olacağı için
 * hidrasyon uyuşmazlığı doğardı; tek kaynak sunucu.
 */
const BugunBaglami = createContext<string | null>(null)

export function BugunSaglayici({
  bugun,
  children,
}: {
  bugun: string
  children: React.ReactNode
}) {
  return <BugunBaglami.Provider value={bugun}>{children}</BugunBaglami.Provider>
}

/** Uygulamanın "bugün"ü — simülasyon açıksa o tarih. */
export function useBugun(): string {
  return useContext(BugunBaglami) ?? gercekBugun()
}
