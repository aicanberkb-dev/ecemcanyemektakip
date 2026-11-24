'use client'

import { ArtiEksiEkrani, type ArtiEksiSatiri } from '../arti-eksi/ArtiEksiEkrani'
import { cumhuriyetKaydet, cumhuriyetSil } from '../actions'

/**
 * Cumhuriyet defteri ekranı.
 *
 * Artı/Eksi ile birebir aynı ekran; değişen yalnız yazdığı tablo. Ekranı
 * kopyalamak yerine eylemler parametre geçiliyor, iki defter tek yerden
 * bakılıyor.
 */
export function CumhuriyetEkrani({ satirlar }: { satirlar: ArtiEksiSatiri[] }) {
  return (
    <ArtiEksiEkrani
      satirlar={satirlar}
      islemler={{ kaydet: cumhuriyetKaydet, sil: cumhuriyetSil }}
    />
  )
}
