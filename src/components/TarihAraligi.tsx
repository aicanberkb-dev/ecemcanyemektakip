import Link from 'next/link'

type Props = {
  bas: string
  bit: string
  /** Ek gizli alanlar (ör. sınıf filtresi) */
  ekstra?: Record<string, string | undefined>
  temizleYolu?: string
  cocuklar?: React.ReactNode
}

export function TarihAraligi({ bas, bit, ekstra, temizleYolu, cocuklar }: Props) {
  return (
    <form className="kart flex flex-wrap items-end gap-3 p-4">
      <div>
        <label className="etiket" htmlFor="bas">
          Başlangıç
        </label>
        <input id="bas" type="date" name="bas" defaultValue={bas} className="girdi" />
      </div>
      <div>
        <label className="etiket" htmlFor="bit">
          Bitiş
        </label>
        <input id="bit" type="date" name="bit" defaultValue={bit} className="girdi" />
      </div>

      {cocuklar}

      {Object.entries(ekstra ?? {}).map(([ad, deger]) =>
        deger ? <input key={ad} type="hidden" name={ad} value={deger} /> : null,
      )}

      <button className="btn-birincil">Uygula</button>
      {temizleYolu && (
        <Link href={temizleYolu} className="btn-ikincil">
          Temizle
        </Link>
      )}
    </form>
  )
}
