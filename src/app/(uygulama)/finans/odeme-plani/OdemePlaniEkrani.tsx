'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { gunAdi, para, tarih as tarihBicim } from '@/lib/format'

import { planEkle, planOdendi, planSil } from './actions'

export type Kalem = {
  id: string
  /** Elle eklenenlerde kaydın kendi kimliği; ödendi ve sil onu kullanıyor */
  planId?: string
  tur: string
  /** YYYY-AA-GG */
  vade: string
  kime: string
  /** Tutarı henüz girilmemiş kalemlerde null */
  tutar: number | null
  not: string | null
  /** Kalemin girildiği ekran */
  yol?: string
}

/** Tür rozetinin rengi; bakışta ne olduğu ayrılsın */
const RENK: Record<string, string> = {
  Maaş: 'bg-violet-100 text-violet-800',
  Senet: 'bg-amber-100 text-amber-900',
  SGK: 'bg-sky-100 text-sky-800',
  Elektrik: 'bg-yellow-100 text-yellow-900',
  Su: 'bg-cyan-100 text-cyan-900',
  Doğalgaz: 'bg-orange-100 text-orange-900',
  Elle: 'bg-slate-200 text-slate-800',
}

export function OdemePlaniEkrani({
  kalemler,
  bas,
  bit,
  bugun,
  oncekiHafta,
  sonrakiHafta,
}: {
  kalemler: Kalem[]
  bas: string
  bit: string
  bugun: string
  oncekiHafta: string
  sonrakiHafta: string
}) {
  const router = useRouter()
  const [bekliyor, baslat] = useTransition()
  const [mesaj, setMesaj] = useState<{ tip: 'ok' | 'hata'; metin: string } | null>(null)
  const [form, setForm] = useState({ vade_tarihi: bugun, kime: '', tutar: '', aciklama: '' })

  const haftalik = kalemler.filter((k) => k.vade >= bas && k.vade <= bit)
  // Vadesi geçmiş ve hâlâ ödenmemişler hafta değişince kaybolmasın
  const gecikmis = kalemler.filter((k) => k.vade < bugun && k.vade < bas)

  const toplam = (liste: Kalem[]) => liste.reduce((t, k) => t + (k.tutar ?? 0), 0)
  const tutarsiz = (liste: Kalem[]) => liste.filter((k) => k.tutar === null).length

  function calistir(is: () => Promise<{ hata?: string; basari?: string }>) {
    baslat(async () => {
      const sonuc = await is()
      setMesaj(
        sonuc.hata
          ? { tip: 'hata', metin: sonuc.hata }
          : sonuc.basari
            ? { tip: 'ok', metin: sonuc.basari }
            : null,
      )
      router.refresh()
    })
  }

  // Haftanın yedi günü; ödemesi olmayan gün de görünsün ki boş gün belli olsun
  const gunler: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${bas}T00:00:00`)
    d.setDate(d.getDate() + i)
    gunler.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`,
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">Ödeme Takvimi</h1>
          <p className="text-sm text-solgun">
            Bu hafta kime ne ödeneceği. Maaş, senet, SGK ve faturalar vadelerine göre
            kendiliğinden düşer; bunların dışındakileri aşağıdan elle ekleyebilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/finans/odeme-plani?hafta=${oncekiHafta}`} className="btn-ikincil !py-1.5">
            ← Önceki
          </Link>
          <Link href="/finans/odeme-plani" className="btn-ikincil !py-1.5">
            Bu hafta
          </Link>
          <Link href={`/finans/odeme-plani?hafta=${sonrakiHafta}`} className="btn-ikincil !py-1.5">
            Sonraki →
          </Link>
        </div>
      </div>

      {mesaj && (
        <p
          className={`rounded-md px-4 py-3 text-sm ${
            mesaj.tip === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {mesaj.metin}
        </p>
      )}

      <div className="kart flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">Hafta</p>
          <p className="font-semibold">
            {tarihBicim(bas)} – {tarihBicim(bit)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">Kalem</p>
          <p className="font-semibold tabular-nums">{haftalik.length}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs font-semibold tracking-wide text-solgun uppercase">
            Haftanın toplamı
          </p>
          <p className="text-2xl font-bold text-red-700 tabular-nums">{para(toplam(haftalik))}</p>
          {tutarsiz(haftalik) > 0 && (
            <p className="text-xs text-solgun">
              {tutarsiz(haftalik)} kalemin tutarı henüz girilmemiş
            </p>
          )}
        </div>
      </div>

      {gecikmis.length > 0 && (
        <div className="kart overflow-hidden border-red-200">
          <h2 className="flex items-baseline gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
            <span>Vadesi geçmiş</span>
            <span className="ml-auto font-normal tabular-nums">
              {gecikmis.length} kalem · {para(toplam(gecikmis))}
            </span>
          </h2>
          <ul className="divide-y divide-cizgi">
            {gecikmis.map((k) => (
              <KalemSatiri
                key={k.id}
                kalem={k}
                bekliyor={bekliyor}
                calistir={calistir}
                bugun={bugun}
                gecikmis
              />
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {gunler.map((g) => {
          const gunun = haftalik.filter((k) => k.vade === g)
          return (
            <div key={g} className={`kart overflow-hidden ${g === bugun ? 'ring-2 ring-vurgu' : ''}`}>
              <h2 className="flex flex-wrap items-baseline gap-2 border-b border-cizgi bg-slate-50 px-4 py-2 text-sm font-semibold">
                <span>
                  {tarihBicim(g)} <span className="text-solgun">{gunAdi(g)}</span>
                </span>
                {g === bugun && (
                  <span className="rozet bg-blue-100 text-blue-800">bugün</span>
                )}
                <span className="ml-auto font-normal tabular-nums">
                  {gunun.length > 0 ? para(toplam(gunun)) : ''}
                </span>
              </h2>

              {gunun.length === 0 ? (
                <p className="px-4 py-2 text-xs text-solgun">ödeme yok</p>
              ) : (
                <ul className="divide-y divide-cizgi">
                  {gunun.map((k) => (
                    <KalemSatiri
                      key={k.id}
                      kalem={k}
                      bekliyor={bekliyor}
                      calistir={calistir}
                      bugun={bugun}
                    />
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <form
        className="kart space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          calistir(async () => {
            const sonuc = await planEkle(form)
            if (!sonuc.hata) setForm({ vade_tarihi: bugun, kime: '', tutar: '', aciklama: '' })
            return sonuc
          })
        }}
      >
        <p className="text-sm font-semibold">Takvime elle ekle</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-solgun">
            <span className="block font-semibold">Vade tarihi</span>
            <input
              type="date"
              value={form.vade_tarihi}
              onChange={(e) => setForm({ ...form, vade_tarihi: e.target.value })}
              className="girdi mt-0.5 !py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-solgun">
            <span className="block font-semibold">Kime</span>
            <input
              value={form.kime}
              onChange={(e) => setForm({ ...form, kime: e.target.value })}
              placeholder="Kişi / firma"
              className="girdi mt-0.5 w-44 !py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-solgun">
            <span className="block font-semibold">Tutar</span>
            <input
              inputMode="decimal"
              value={form.tutar}
              onChange={(e) => setForm({ ...form, tutar: e.target.value })}
              placeholder="0,00"
              className="girdi mt-0.5 w-28 !py-1.5 text-right text-sm tabular-nums"
            />
          </label>
          <label className="flex-1 text-xs text-solgun">
            <span className="block font-semibold">Açıklama</span>
            <input
              value={form.aciklama}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
              placeholder="İsteğe bağlı"
              className="girdi mt-0.5 w-full !py-1.5 text-sm"
            />
          </label>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            Ekle
          </button>
        </div>
      </form>

      <p className="text-xs text-solgun">
        Elle eklenen kalemi ödendi işaretlerseniz tutarı günlük masraflara yazılır. Maaş,
        senet, SGK ve faturalar kendi ekranlarından ödenir; ödendikçe bu takvimden
        düşerler. SGK vadesi, dönemi takip eden ayın son günü sayılır.
      </p>
    </div>
  )
}

function KalemSatiri({
  kalem,
  bekliyor,
  calistir,
  bugun,
  gecikmis = false,
}: {
  kalem: Kalem
  bekliyor: boolean
  calistir: (is: () => Promise<{ hata?: string; basari?: string }>) => void
  bugun: string
  gecikmis?: boolean
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      <span className={`rozet ${RENK[kalem.tur] ?? 'bg-slate-100 text-slate-700'}`}>
        {kalem.tur}
      </span>
      <span className="font-medium">{kalem.kime}</span>
      {kalem.not && <span className="text-xs text-solgun">{kalem.not}</span>}
      {gecikmis && <span className="text-xs text-red-700">{tarihBicim(kalem.vade)}</span>}

      <span className="ml-auto font-semibold tabular-nums">
        {kalem.tutar === null ? (
          <span className="text-xs font-normal text-solgun">tutar girilmedi</span>
        ) : (
          para(kalem.tutar)
        )}
      </span>

      {kalem.planId ? (
        <>
          <button
            type="button"
            disabled={bekliyor}
            onClick={() => calistir(() => planOdendi(kalem.planId!, true, bugun))}
            className="rounded border border-cizgi bg-white px-2 py-1 text-xs font-semibold text-solgun hover:bg-slate-50 disabled:opacity-50"
          >
            Ödendi
          </button>
          <button
            type="button"
            disabled={bekliyor}
            aria-label={`${kalem.kime} kalemini sil`}
            onClick={() => calistir(() => planSil(kalem.planId!))}
            className="rounded border border-cizgi px-1.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            ✕
          </button>
        </>
      ) : (
        kalem.yol && (
          <Link href={kalem.yol} className="text-xs text-vurgu hover:underline">
            ekranına git →
          </Link>
        )
      )}
    </li>
  )
}
