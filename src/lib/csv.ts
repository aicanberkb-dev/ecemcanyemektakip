/**
 * Excel'in Türkçe yerelinde doğru açılması için: ; ayracı, virgüllü ondalık
 * ve UTF-8 BOM.
 */
export function hucre(deger: string | number | null | undefined): string {
  return `"${String(deger ?? '').replace(/"/g, '""')}"`
}

export function csvSayi(deger: number | string | null | undefined): string {
  return `"${Number(deger ?? 0).toFixed(2).replace('.', ',')}"`
}

export function csvMetni(basliklar: string[], satirlar: string[][]): string {
  const govde = satirlar.map((s) => s.join(';'))
  return '﻿' + [basliklar.map(hucre).join(';'), ...govde].join('\r\n')
}

/** Dosya adında sorun çıkaracak karakterleri temizler. */
export function dosyaAdi(...parcalar: string[]): string {
  return parcalar
    .map((p) => p.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-')
}
