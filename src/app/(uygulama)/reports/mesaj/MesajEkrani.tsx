'use client'

import { useMemo, useState } from 'react'

import { para, tarih as tarihBicim } from '@/lib/format'

export type MesajSatiri = {
  student_id: string
  ogrenci: string
  sinif: string | null
  veli: string | null
  /** Uluslararası biçimde (+905…); çevrilemeyen numara null gelir */
  telefon: string | null
  /** Borç/eksik tutarı ya da "Aylıkçı" gibi bir etiket */
  tutar: number | string
}

type SekmeAdi = 'borc' | 'taksit' | 'duyuru'

const SEKMELER: {
  ad: SekmeAdi
  baslik: string
  tutarBasligi: string
  varsayilanSablon: string
  aciklama: string
}[] = [
  {
    ad: 'borc',
    baslik: 'Borçlu günlükçüler',
    tutarBasligi: 'Bakiye',
    varsayilanSablon:
      'Sn. {veli}, {ogrenci} ({sinif}) adlı öğrencimizin {tarih} itibarıyla yemekhane bakiyesi {tutar} borçlu görünmektedir.\n\nÖdemenizi okuldan ya da havale ile yapabilirsiniz. İyi günler dileriz.\n— {okul} Yemekhane',
    aciklama: 'Bakiyesi eksiye düşmüş günlükçüler. Aylıkçılar burada yer almaz.',
  },
  {
    ad: 'taksit',
    baslik: 'Taksiti geçenler',
    tutarBasligi: 'Eksik',
    varsayilanSablon:
      'Sn. {veli}, {ogrenci} ({sinif}) adlı öğrencimizin vadesi geçmiş {tutar} tutarında taksit ödemesi görünmektedir.\n\nÖdemenizi yaptıysanız lütfen bu mesajı dikkate almayınız.\n— {okul} Yemekhane',
    aciklama: 'Vadesi geldiği hâlde eksik ödemesi olan aylıkçılar.',
  },
  {
    ad: 'duyuru',
    baslik: 'Duyuru — tüm veliler',
    tutarBasligi: 'Abone',
    varsayilanSablon:
      'Sayın velimiz, {ogrenci} ({sinif}) için yemek listemiz okulumuzun panosunda yer almaktadır.\n\nAfiyet olsun.\n— {okul} Yemekhane',
    aciklama: 'Okulun bütün aktif öğrencileri.',
  },
]

const YER_TUTUCULAR = ['{veli}', '{ogrenci}', '{sinif}', '{tutar}', '{tarih}', '{okul}']

/** +905350251165 → 905350251165 (WhatsApp bağlantısı artı işareti istemiyor) */
function waNumara(telefon: string): string {
  return telefon.replace(/\D/g, '')
}

export function MesajEkrani({
  okulAdi,
  bugun,
  borc,
  taksit,
  duyuru,
}: {
  okulAdi: string
  bugun: string
  borc: MesajSatiri[]
  taksit: MesajSatiri[]
  duyuru: MesajSatiri[]
}) {
  const [aktif, setAktif] = useState<SekmeAdi>('borc')
  const [sablonlar, setSablonlar] = useState<Record<SekmeAdi, string>>(() =>
    Object.fromEntries(SEKMELER.map((s) => [s.ad, s.varsayilanSablon])) as Record<
      SekmeAdi,
      string
    >,
  )
  const [secili, setSecili] = useState<Set<string>>(new Set())
  // Gönderildi işareti tarayıcıda kalır; sekme kapanınca sıfırlanır.
  const [gonderilen, setGonderilen] = useState<Set<string>>(new Set())
  const [kuyruk, setKuyruk] = useState<MesajSatiri[] | null>(null)
  const [sira, setSira] = useState(0)
  const [yontem, setYontem] = useState<'app' | 'web'>('app')
  const [kopyaNotu, setKopyaNotu] = useState(false)

  const listeler: Record<SekmeAdi, MesajSatiri[]> = useMemo(
    () => ({ borc, taksit, duyuru }),
    [borc, taksit, duyuru],
  )

  const sekme = SEKMELER.find((s) => s.ad === aktif)!
  const satirlar = listeler[aktif]
  const sablon = sablonlar[aktif]

  const metinUret = useMemo(
    () => (s: MesajSatiri) =>
      sablon
        .replaceAll('{veli}', s.veli ?? 'Velimiz')
        .replaceAll('{ogrenci}', s.ogrenci)
        .replaceAll('{sinif}', s.sinif ?? '—')
        .replaceAll('{tutar}', typeof s.tutar === 'number' ? para(s.tutar) : s.tutar)
        .replaceAll('{tarih}', tarihBicim(bugun))
        .replaceAll('{okul}', okulAdi),
    [sablon, bugun, okulAdi],
  )

  function sekmeSec(ad: SekmeAdi) {
    setAktif(ad)
    setSecili(new Set())
  }

  const secilebilir = satirlar.filter((s) => s.telefon && !gonderilen.has(s.student_id))
  const telefonsuz = satirlar.filter((s) => !s.telefon).length
  const hepsiSecili = secilebilir.length > 0 && secilebilir.every((s) => secili.has(s.student_id))

  function tumunuDegistir() {
    setSecili(hepsiSecili ? new Set() : new Set(secilebilir.map((s) => s.student_id)))
  }

  function sablonDegistir(deger: string) {
    setSablonlar((onceki) => ({ ...onceki, [aktif]: deger }))
  }

  function yerTutucuEkle(ek: string) {
    sablonDegistir(`${sablon}${ek}`)
  }

  function yontemSec(y: 'app' | 'web') {
    setYontem(y)
    try {
      localStorage.setItem('wa-yontem', y)
    } catch {
      /* özel sekme */
    }
  }

  function baslat() {
    const liste = satirlar.filter((s) => secili.has(s.student_id))
    if (liste.length === 0) return

    // Açılış yöntemi tercihi hatırlanır. Kuyruk açılırken okunuyor: sunucuda
    // localStorage yok, ilk render'da okunursa sayfa uyuşmazlığı çıkıyor.
    try {
      const kayit = localStorage.getItem('wa-yontem')
      if (kayit === 'app' || kayit === 'web') setYontem(kayit)
    } catch {
      /* özel sekme: varsayılanla devam */
    }

    setKuyruk(liste)
    setSira(0)
  }

  const suanki = kuyruk?.[sira] ?? null

  /**
   * Masaüstü: whatsapp:// — tarayıcı sekmesi hiç açılmaz, uygulama gelir.
   * Web: wa.me + adlandırılmış hedef — hep aynı sekme kullanılır, her
   * veli için yeni sekme açılmaz.
   */
  function waBaglanti(s: MesajSatiri): string {
    const no = waNumara(s.telefon ?? '')
    const metin = encodeURIComponent(metinUret(s))
    return yontem === 'app'
      ? `whatsapp://send?phone=${no}&text=${metin}`
      : `https://wa.me/${no}?text=${metin}`
  }

  function ilerle() {
    if (!kuyruk) return
    if (sira + 1 >= kuyruk.length) {
      setKuyruk(null)
      setSira(0)
      setSecili(new Set())
      return
    }
    setSira(sira + 1)
  }

  function gonderildiIsaretle() {
    if (!suanki) return
    setGonderilen((onceki) => new Set(onceki).add(suanki.student_id))
    ilerle()
  }

  async function kopyala() {
    if (!suanki) return
    try {
      await navigator.clipboard.writeText(metinUret(suanki))
      setKopyaNotu(true)
      setTimeout(() => setKopyaNotu(false), 1600)
    } catch {
      setKopyaNotu(false)
    }
  }

  const ornek = satirlar.find((s) => secili.has(s.student_id)) ?? secilebilir[0] ?? satirlar[0]

  return (
    <>
      {/* Sekmeler */}
      <div className="flex flex-wrap gap-1 border-b border-cizgi">
        {SEKMELER.map((s) => (
          <button
            key={s.ad}
            type="button"
            onClick={() => sekmeSec(s.ad)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              aktif === s.ad
                ? 'border-vurgu text-vurgu'
                : 'border-transparent text-solgun hover:text-metin'
            }`}
          >
            {s.baslik}
            <span
              className={`rounded-full px-2 text-xs font-bold tabular-nums ${
                aktif === s.ad ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {listeler[s.ad].length}
            </span>
          </button>
        ))}
      </div>

      {/* Şablon */}
      <div className="kart p-4">
        <h2 className="mb-2 text-sm font-semibold">Mesaj şablonu</h2>
        <textarea
          value={sablon}
          onChange={(e) => sablonDegistir(e.target.value)}
          spellCheck={false}
          rows={5}
          className="w-full rounded-md border border-cizgi bg-white px-3 py-2 text-sm
                     text-metin outline-none focus:border-vurgu focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-solgun uppercase">Ekle:</span>
          {YER_TUTUCULAR.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => yerTutucuEkle(y)}
              className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono
                         text-xs font-semibold text-blue-700 hover:bg-blue-100"
            >
              {y}
            </button>
          ))}
        </div>

        {ornek && (
          <div className="mt-3 rounded-lg rounded-bl-sm border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="mb-1 text-xs font-semibold tracking-wide text-emerald-800 uppercase">
              Önizleme · {ornek.ogrenci}
            </p>
            <p className="text-sm whitespace-pre-wrap text-metin">{metinUret(ornek)}</p>
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="kart overflow-x-auto">
        <div className="flex flex-wrap items-center gap-3 border-b border-cizgi px-4 py-3">
          <h2 className="font-semibold">{sekme.baslik}</h2>
          <span className="text-xs text-solgun">{sekme.aciklama}</span>
          <button
            type="button"
            onClick={tumunuDegistir}
            disabled={secilebilir.length === 0}
            className="btn-ikincil ml-auto !py-1.5 text-sm disabled:opacity-50"
          >
            {hepsiSecili ? 'Seçimi kaldır' : 'Tümünü seç'}
          </button>
        </div>
        <table className="tablo">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Öğrenci</th>
              <th>Veli</th>
              <th>Telefon</th>
              <th className="text-right">{sekme.tutarBasligi}</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s) => {
              const yollandi = gonderilen.has(s.student_id)
              const kilitli = !s.telefon || yollandi
              return (
                <tr
                  key={s.student_id}
                  className={
                    secili.has(s.student_id)
                      ? 'bg-blue-50/60'
                      : !s.telefon
                        ? 'opacity-60'
                        : undefined
                  }
                >
                  <td>
                    <input
                      type="checkbox"
                      disabled={kilitli}
                      checked={secili.has(s.student_id)}
                      onChange={(e) =>
                        setSecili((onceki) => {
                          const yeni = new Set(onceki)
                          if (e.target.checked) yeni.add(s.student_id)
                          else yeni.delete(s.student_id)
                          return yeni
                        })
                      }
                      aria-label={`${s.ogrenci} seç`}
                    />
                  </td>
                  <td>
                    <span className="font-medium">{s.ogrenci}</span>
                    <span className="block text-xs text-solgun">{s.sinif ?? '—'}</span>
                  </td>
                  <td>{s.veli ?? <span className="text-solgun">—</span>}</td>
                  <td className="font-mono text-xs text-solgun">{s.telefon ?? '—'}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {typeof s.tutar === 'number' ? (
                      <span className="text-red-600">{para(s.tutar)}</span>
                    ) : (
                      <span className="rozet bg-slate-100 text-slate-700">{s.tutar}</span>
                    )}
                  </td>
                  <td>
                    {yollandi ? (
                      <span className="rozet bg-emerald-100 text-emerald-800">gönderildi</span>
                    ) : !s.telefon ? (
                      <span className="rozet bg-amber-100 text-amber-800">telefon eksik</span>
                    ) : (
                      <span className="text-xs text-solgun">bekliyor</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {satirlar.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-solgun">
                  Bu listede veli yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Alt eylem çubuğu */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-cizgi bg-white/95 px-4 py-3 backdrop-blur">
        <span className="text-sm text-solgun">
          <strong className="text-metin tabular-nums">{secili.size}</strong> veli seçildi
          {telefonsuz > 0 && (
            <span className="font-semibold text-amber-700">
              {' '}
              · {telefonsuz} veli telefonsuz, gönderilemez
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={baslat}
          disabled={secili.size === 0}
          className="btn-birincil ml-auto disabled:opacity-50"
        >
          Gönderime Başla
        </button>
      </div>

      {/* Sıralı gönderim kuyruğu */}
      {kuyruk && suanki && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-cizgi bg-white shadow-xl">
            <div className="h-1 bg-slate-100">
              <div
                className="h-full bg-vurgu transition-all"
                style={{ width: `${(sira / kuyruk.length) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-3 border-b border-cizgi px-4 py-3">
              <span className="text-xl font-bold tabular-nums">
                {sira + 1}{' '}
                <span className="text-base font-medium text-solgun">/ {kuyruk.length}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setKuyruk(null)
                  setSira(0)
                }}
                className="btn-ikincil ml-auto !py-1.5 text-sm"
              >
                Kuyruğu kapat
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-dashed border-cizgi pb-3">
                <span className="text-lg font-semibold">{suanki.veli ?? 'Velimiz'}</span>
                <span className="font-mono text-sm text-solgun">{suanki.telefon}</span>
                <span className="rozet bg-slate-100 text-slate-700">
                  {suanki.ogrenci} · {suanki.sinif ?? '—'}
                </span>
              </div>

              <div className="ml-auto max-w-[90%] rounded-lg rounded-br-sm border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-sm whitespace-pre-wrap text-metin">{metinUret(suanki)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={waBaglanti(suanki)}
                  {...(yontem === 'web' ? { target: 'whatsapp' } : {})}
                  rel="noopener"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white
                             transition hover:bg-emerald-700"
                >
                  WhatsApp&apos;ta Aç
                </a>
                <button type="button" onClick={gonderildiIsaretle} className="btn-ikincil !py-2">
                  Gönderildi ✓
                </button>
                <button type="button" onClick={ilerle} className="btn-ikincil !py-2">
                  Atla
                </button>
                <button type="button" onClick={kopyala} className="btn-ikincil !py-2">
                  {kopyaNotu ? 'Kopyalandı ✓' : 'Metni kopyala'}
                </button>

                <span className="ml-auto inline-flex overflow-hidden rounded-md border border-cizgi">
                  <button
                    type="button"
                    onClick={() => yontemSec('app')}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      yontem === 'app' ? 'bg-blue-50 text-blue-700' : 'text-solgun'
                    }`}
                  >
                    Masaüstü
                  </button>
                  <button
                    type="button"
                    onClick={() => yontemSec('web')}
                    className={`border-l border-cizgi px-3 py-1.5 text-xs font-semibold ${
                      yontem === 'web' ? 'bg-blue-50 text-blue-700' : 'text-solgun'
                    }`}
                  >
                    Web
                  </button>
                </span>
              </div>

              <p className="text-xs text-solgun">
                <strong>Masaüstü</strong> seçiliyken WhatsApp uygulaması açılır, tarayıcı
                sekmesi devreye girmez. <strong>Web</strong> seçiliyken hep aynı sekme
                kullanılır — her veli için yeni sekme açılmaz.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
