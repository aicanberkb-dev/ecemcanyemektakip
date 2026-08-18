'use client'

import { useActionState, useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'
import type { UcretGecmisi } from '@/lib/types'

import { tarifeEkle, tarifeGuncelle, tarifeSil, type AyarDurumu } from './actions'

/**
 * Tarihli ücret tarifesi.
 *
 * Fiyatlar yıl içinde değişiyor. Tek bir güncel fiyat tutulunca geçmişe dönük
 * her hesap yanlış oluyordu: geçmiş bir güne toplu giriş yapıldığında ya da
 * abone tipi değişip öğünler yeniden hesaplandığında bugünün fiyatı
 * uygulanıyordu. Artık her öğün ait olduğu günün tarifesinden fiyatlanır.
 */
export function UcretGecmisiBolumu({
  tarifeler,
  bugun,
}: {
  tarifeler: UcretGecmisi[]
  bugun: string
}) {
  const [acik, setAcik] = useState(false)
  const [durum, gonder, bekliyor] = useActionState(tarifeEkle, {} as AyarDurumu)

  if (durum.basari && acik) setAcik(false)

  // En yeni üstte; geçerli olan, başlangıcı bugünden büyük olmayan ilk satır
  const sirali = [...tarifeler].sort((a, b) =>
    b.gecerli_baslangic.localeCompare(a.gecerli_baslangic),
  )
  const gecerli = sirali.find((t) => t.gecerli_baslangic <= bugun)

  return (
    <div className="space-y-4">
      <p className="text-sm text-solgun">
        Her tarife bir <strong>başlangıç tarihinden</strong> itibaren geçerlidir. Bir
        öğün, ait olduğu günün tarifesinden fiyatlanır — geçmişe dönük toplu giriş
        yaptığınızda o tarihteki fiyat uygulanır, bugünkü değil. Ücretli öğün de bu
        günlük ücrete tabidir; misafirden ücret alınmaz.
      </p>

      <div className="overflow-x-auto">
        <table className="tablo">
          <thead>
            <tr>
              <th>Geçerlilik Başlangıcı</th>
              <th className="text-right">Günlük Ücret</th>
              <th>Açıklama</th>
              <th className="text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {sirali.map((t) => (
              <TarifeSatiri
                key={t.id}
                tarife={t}
                gecerliMi={gecerli?.id === t.id}
                gelecekMi={t.gecerli_baslangic > bugun}
              />
            ))}
            {sirali.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-solgun">
                  Tarife tanımlı değil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {acik ? (
        <form action={gonder} className="flex flex-wrap items-end gap-3 border-t border-cizgi pt-4">
          <div>
            <label className="etiket text-xs">Geçerlilik başlangıcı</label>
            <input type="date" name="gecerli_baslangic" className="girdi !py-1.5" required />
            {durum.alanlar?.gecerli_baslangic && (
              <p className="hata">{durum.alanlar.gecerli_baslangic}</p>
            )}
          </div>
          <div>
            <label className="etiket text-xs">Günlük ücret (₺)</label>
            <input
              name="taban_gunluk_ucret"
              inputMode="decimal"
              defaultValue={gecerli ? String(gecerli.taban_gunluk_ucret).replace('.', ',') : ''}
              className="girdi !py-1.5 w-32"
              required
            />
            {durum.alanlar?.taban_gunluk_ucret && (
              <p className="hata">{durum.alanlar.taban_gunluk_ucret}</p>
            )}
          </div>
          <div className="min-w-40 flex-1">
            <label className="etiket text-xs">Açıklama</label>
            <input
              name="aciklama"
              placeholder="ör. Şubat zammı"
              className="girdi !py-1.5"
            />
          </div>
          <button className="btn-birincil !py-1.5" disabled={bekliyor}>
            {bekliyor ? 'Ekleniyor…' : 'Tarife Ekle'}
          </button>
          <button type="button" onClick={() => setAcik(false)} className="btn-ikincil !py-1.5">
            Vazgeç
          </button>
          {durum.hata && <p className="hata w-full">{durum.hata}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setAcik(true)} className="btn-ikincil">
          + Yeni Tarife (fiyat değişikliği)
        </button>
      )}

      <p className="text-xs text-solgun">
        Yeni tarife eklemek eski kayıtları değiştirmez; geçmiş öğünler kendi
        tarihlerindeki fiyattan hesaplanmaya devam eder. İleri tarihli tarife
        girebilirsiniz — o tarih gelene kadar mevcut tarife geçerli kalır.
      </p>
    </div>
  )
}

function TarifeSatiri({
  tarife,
  gecerliMi,
  gelecekMi,
}: {
  tarife: UcretGecmisi
  gecerliMi: boolean
  gelecekMi: boolean
}) {
  const [duzenle, setDuzenle] = useState(false)
  const [siliniyor, setSiliniyor] = useState(false)
  const eylem = tarifeGuncelle.bind(null, tarife.id)
  const [durum, gonder, bekliyor] = useActionState(eylem, {} as AyarDurumu)

  if (durum.basari && duzenle) setDuzenle(false)

  if (duzenle) {
    return (
      <tr className="bg-blue-50/40">
        <td colSpan={4} className="px-3 py-3">
          <form action={gonder} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="etiket text-xs">Başlangıç</label>
              <input
                type="date"
                name="gecerli_baslangic"
                defaultValue={tarife.gecerli_baslangic}
                className="girdi !py-1.5"
              />
            </div>
            <div>
              <label className="etiket text-xs">Günlük</label>
              <input
                name="taban_gunluk_ucret"
                inputMode="decimal"
                defaultValue={String(tarife.taban_gunluk_ucret).replace('.', ',')}
                className="girdi !py-1.5 w-28"
              />
            </div>
            <div className="min-w-32 flex-1">
              <label className="etiket text-xs">Açıklama</label>
              <input
                name="aciklama"
                defaultValue={tarife.aciklama ?? ''}
                className="girdi !py-1.5"
              />
            </div>
            <button className="btn-birincil !py-1.5" disabled={bekliyor}>
              Kaydet
            </button>
            <button type="button" onClick={() => setDuzenle(false)} className="btn-ikincil !py-1.5">
              Vazgeç
            </button>
            {durum.hata && <p className="hata w-full">{durum.hata}</p>}
          </form>
        </td>
      </tr>
    )
  }

  return (
    <tr className={gecerliMi ? 'bg-emerald-50/50' : undefined}>
      <td className="font-medium whitespace-nowrap">
        {tarihBicim(tarife.gecerli_baslangic)}
        {gecerliMi && (
          <span className="rozet ml-2 bg-emerald-100 text-emerald-800">şu an geçerli</span>
        )}
        {gelecekMi && (
          <span className="rozet ml-2 bg-blue-100 text-blue-800">ileri tarihli</span>
        )}
      </td>
      <td className="text-right tabular-nums">{para(tarife.taban_gunluk_ucret)}</td>
      <td className="text-solgun">{tarife.aciklama ?? '—'}</td>
      <td className="text-right whitespace-nowrap">
        <button
          type="button"
          onClick={() => setDuzenle(true)}
          className="text-xs text-vurgu hover:underline"
        >
          Düzelt
        </button>
        <span className="mx-2 text-cizgi">|</span>
        <button
          type="button"
          disabled={siliniyor}
          onClick={async () => {
            if (
              !confirm(
                `${tarihBicim(tarife.gecerli_baslangic)} tarifesi silinecek.\n` +
                  'Bu tarihten sonraki öğünler bir önceki tarifeden hesaplanmaya başlar. Emin misiniz?',
              )
            )
              return
            setSiliniyor(true)
            try {
              await tarifeSil(tarife.id)
            } finally {
              setSiliniyor(false)
            }
          }}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {siliniyor ? 'Siliniyor…' : 'Sil'}
        </button>
      </td>
    </tr>
  )
}
