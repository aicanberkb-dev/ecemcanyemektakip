import { z } from 'zod'

/**
 * Türkçe ondalık ayracını (virgül) kabul eden sayı alanı.
 * "1.234,50" ve "1234.50" biçimlerinin ikisi de çalışır.
 */
export const trSayi = (opts?: { min?: number; max?: number }) =>
  z
    .union([z.string(), z.number()])
    .transform((deger, ctx) => {
      if (typeof deger === 'number') return deger
      const temiz = deger.trim().replace(/\s/g, '')
      if (temiz === '') return 0
      // Binlik ayracı olarak nokta kullanılmışsa at, virgülü noktaya çevir
      const normal = temiz.includes(',')
        ? temiz.replace(/\./g, '').replace(',', '.')
        : temiz
      const sayi = Number(normal)
      if (Number.isNaN(sayi)) {
        ctx.addIssue({ code: 'custom', message: 'Geçerli bir sayı girin.' })
        return z.NEVER
      }
      return sayi
    })
    .superRefine((sayi, ctx) => {
      if (opts?.min !== undefined && sayi < opts.min) {
        ctx.addIssue({ code: 'custom', message: `En az ${opts.min} olmalı.` })
      }
      if (opts?.max !== undefined && sayi > opts.max) {
        ctx.addIssue({ code: 'custom', message: `En fazla ${opts.max} olmalı.` })
      }
    })

/** <select> ve checkbox'tan gelen "true"/"false" string'ini boolean'a çevirir. */
export const trBoolean = z
  .union([z.boolean(), z.string()])
  .transform((deger) => {
    if (typeof deger === 'boolean') return deger
    return deger === 'true' || deger === 'on' || deger === '1'
  })

/** Boş string'i null'a çeviren metin alanı. */
export const bosNull = z
  .string()
  .optional()
  .transform((deger) => {
    const temiz = deger?.trim()
    return temiz ? temiz : null
  })
