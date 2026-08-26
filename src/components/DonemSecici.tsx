import Link from 'next/link'

import { AY_ADLARI, tarih as tarihBicim } from '@/lib/format'
import type { Donem } from '@/lib/donem'

/**
 * Ay/yıl seçimi + serbest tarih aralığı.
 *
 * İkisi aynı formda: normal kullanımda ay seçilir, ay atlayan bir soru varsa
 * alttaki iki tarih doldurulur ve aralık kazanır. Ayrı ekranlar yapmak yerine
 * tek form olması, hangi dönemin geçerli olduğunu tek bakışta gösteriyor.
 */
export function DonemSecici({
  donem,
  temizleYolu,
  ekstra,
  cocuklar,
  sag,
}: {
  donem: Donem
  /** "Aya dön" bağlantısının hedefi */
  temizleYolu: string
  /** Formda korunacak diğer parametreler (ör. seçili hizmet yeri) */
  ekstra?: Record<string, string | number | undefined>
  cocuklar?: React.ReactNode
  /** Sağa yaslanan ek düğmeler (yazdır, CSV…) */
  sag?: React.ReactNode
}) {
  return (
    <div className="kart yazdirma-gizle p-4">
      <form className="flex flex-wrap items-end gap-3">
        {Object.entries(ekstra ?? {}).map(([ad, deger]) =>
          deger === undefined ? null : (
            <input key={ad} type="hidden" name={ad} value={String(deger)} />
          ),
        )}

        <div>
          <label className="etiket" htmlFor="ay">
            Ay
          </label>
          <select id="ay" name="ay" defaultValue={String(donem.ay)} className="girdi">
            {AY_ADLARI.map((adi, i) => (
              <option key={adi} value={i + 1}>
                {adi}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiket" htmlFor="yil">
            Yıl
          </label>
          <input
            id="yil"
            type="number"
            name="yil"
            defaultValue={donem.yil}
            min={2000}
            max={2100}
            className="girdi w-24"
          />
        </div>

        <span className="pb-2 text-xs text-solgun">ya da</span>

        <div>
          <label className="etiket" htmlFor="bas">
            Başlangıç
          </label>
          <input
            id="bas"
            type="date"
            name="bas"
            defaultValue={donem.ozel ? donem.bas : ''}
            className="girdi"
          />
        </div>
        <div>
          <label className="etiket" htmlFor="bit">
            Bitiş
          </label>
          <input
            id="bit"
            type="date"
            name="bit"
            defaultValue={donem.ozel ? donem.bit : ''}
            className="girdi"
          />
        </div>

        {cocuklar}

        <button className="btn-birincil">Göster</button>

        {donem.ozel && (
          <Link href={temizleYolu} className="btn-ikincil">
            Aya dön
          </Link>
        )}

        {sag && <div className="ml-auto flex flex-wrap items-end gap-2">{sag}</div>}
      </form>

      <p className="mt-2 text-xs text-solgun">
        {donem.ozel ? (
          <>
            Seçili aralık: <strong>{tarihBicim(donem.bas)}</strong> –{' '}
            <strong>{tarihBicim(donem.bit)}</strong>. Aya dönmek için tarihleri boşaltın
            ya da <strong>Aya dön</strong> deyin.
          </>
        ) : (
          <>
            Ay seçiliyken tarih kutuları boştur. Ay atlayan bir aralık için ikisini de
            doldurun — ör. 15 Ağustos – 15 Eylül.
          </>
        )}
      </p>
    </div>
  )
}
