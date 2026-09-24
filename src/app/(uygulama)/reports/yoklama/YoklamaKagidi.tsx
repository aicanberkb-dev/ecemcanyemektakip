import { AY_ADLARI } from '@/lib/format'

/**
 * 1. sınıf yemek yoklama kâğıdı — yatay A4, her şube tek sayfa.
 *
 * Bütün ölçüler milimetre: kâğıt ekranda da basıldığı boyutta çizilir. Satır
 * sayısı öğrenci sayısına göre değişir ama kâğıdın yüksekliği sabittir:
 * satırlar kalan alanı paylaşır, kalabalık şubede incelir, sayfa taşmaz.
 * Yeni kayıtlar elle yazılabilsin diye her şubenin altında boş satır bırakılır.
 */

const KAGIT_GEN = 297
const KAGIT_YUK = 210
const KENAR = 7

/** Logo büyüdü: başlık şeridi de onu alacak kadar yükseldi */
const BASLIK_YUK = 19
const BASLIK_ARALIK = 2
const GUN_BASLIK_YUK = 7
const ALT_YUK = 7
/** Kenarlık kalınlıkları ve yuvarlama için pay: sayfa hiçbir durumda taşmasın */
const PAY = 4

const SIRA_GEN = 7
const AD_GEN = 54
const TOPLAM_GEN = 14

/** Yeni kayıtlar için her şubede bırakılan en az boş satır */
const BOS_SATIR = 4
/** Az öğrencili şubede de tablo sayfayı doldursun */
const EN_AZ_SATIR = 16
/** Çok az satırda satırlar yazı defteri gibi devleşmesin */
const EN_YUKSEK_SATIR = 11

const KENARLIK = '0.25mm solid #444'

/** Yatay A4, kenar boşluğu sıfır (kenarı kâğıdın kendi dolgusu verir). */
export function YoklamaSayfaAyari() {
  return (
    <style>{`
      @page { size: A4 landscape; margin: 0; }
      @media print {
        .yoklama-kagidi {
          margin: 0 !important;
          box-shadow: none !important;
        }
        .yoklama-kagidi, .yoklama-kagidi * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `}</style>
  )
}

export function YoklamaKagidi({
  sube,
  okulAdi,
  yil,
  ay,
  ogrenciler,
  kapaliGunler,
  sonMu,
}: {
  sube: string
  okulAdi: string
  yil: number
  ay: number
  ogrenciler: { student_id: string; ad_soyad: string }[]
  /** Ayın tatil günleri (gün numarası); hafta sonları ayrıca hesaplanır */
  kapaliGunler: number[]
  sonMu: boolean
}) {
  const gunSayisi = new Date(yil, ay, 0).getDate()
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1)
  const tatil = new Set(kapaliGunler)
  const kapali = (gun: number) => {
    const g = new Date(yil, ay - 1, gun).getDay()
    return g === 0 || g === 6 || tatil.has(gun)
  }

  const satirSayisi = Math.max(ogrenciler.length + BOS_SATIR, EN_AZ_SATIR)
  const tabloYuk =
    KAGIT_YUK - 2 * KENAR - BASLIK_YUK - BASLIK_ARALIK - GUN_BASLIK_YUK - ALT_YUK - PAY
  const satirYuk = Math.min(EN_YUKSEK_SATIR, tabloYuk / satirSayisi)
  // Yazı satıra göre küçülür; kalabalık şubede de okunur kalsın diye alt sınır
  const yazi = Math.max(2.1, Math.min(3.8, satirYuk * 0.42))
  const gunGen = (KAGIT_GEN - 2 * KENAR - SIRA_GEN - AD_GEN - TOPLAM_GEN) / gunSayisi

  const satirlar: ({ student_id: string; ad_soyad: string } | null)[] = [
    ...ogrenciler,
    ...Array.from({ length: satirSayisi - ogrenciler.length }, () => null),
  ]

  const hucre = { border: KENARLIK, padding: 0 } as const
  const baslikHucre = { ...hucre, background: '#e5e5e5', fontWeight: 700 } as const

  return (
    <section
      className="yoklama-kagidi mx-auto bg-white text-black shadow-md"
      style={{
        width: `${KAGIT_GEN}mm`,
        height: `${KAGIT_YUK}mm`,
        padding: `${KENAR}mm`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        breakAfter: sonMu ? undefined : 'page',
        breakInside: 'avoid',
      }}
    >
      <header
        className="flex items-end justify-between"
        style={{ height: `${BASLIK_YUK}mm`, borderBottom: '0.6mm solid #000', paddingBottom: '1.5mm' }}
      >
        <div className="flex items-end" style={{ gap: '4mm' }}>
          {/* Logo: çizelge sınıfta asılı kalıyor, kimin olduğu belli olsun.
              Siyah-beyaz sürüm — yoklama her zaman düz yazıcıdan çıkıyor. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- vektör logo */}
          <img
            src="/logo/logo-siyah-beyaz.svg"
            alt=""
            style={{ height: '16mm', width: 'auto' }}
          />
          <span className="font-black" style={{ fontSize: '11mm', lineHeight: 1 }}>
            {sube}
          </span>
          <span
            className="font-bold"
            style={{ fontSize: '4.6mm', letterSpacing: '0.04em', paddingBottom: '1mm' }}
          >
            YEMEK YOKLAMA ÇİZELGESİ
          </span>
        </div>
        <div className="text-right" style={{ lineHeight: 1.25 }}>
          <div className="font-bold" style={{ fontSize: '4.2mm' }}>
            {okulAdi}
          </div>
          <div style={{ fontSize: '3.6mm' }}>
            {AY_ADLARI[ay - 1]} {yil} · {ogrenciler.length} öğrenci
          </div>
          <div style={{ fontSize: '2.8mm', letterSpacing: '0.1em' }}>
            EKREM BAŞLANTI - ECEM CAN GIDA
          </div>
        </div>
      </header>

      <table
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          marginTop: `${BASLIK_ARALIK}mm`,
        }}
      >
        <colgroup>
          <col style={{ width: `${SIRA_GEN}mm` }} />
          <col style={{ width: `${AD_GEN}mm` }} />
          {gunler.map((g) => (
            <col key={g} style={{ width: `${gunGen}mm` }} />
          ))}
          <col style={{ width: `${TOPLAM_GEN}mm` }} />
        </colgroup>
        <thead>
          <tr style={{ height: `${GUN_BASLIK_YUK}mm`, fontSize: '3.2mm' }}>
            <th style={baslikHucre}>#</th>
            <th style={{ ...baslikHucre, textAlign: 'left', paddingLeft: '1.5mm' }}>
              Öğrenci Adı Soyadı
            </th>
            {gunler.map((g) => (
              <th
                key={g}
                className="tabular-nums"
                style={{
                  ...baslikHucre,
                  background: kapali(g) ? '#9ca3af' : '#e5e5e5',
                  color: kapali(g) ? '#f3f4f6' : '#000',
                }}
              >
                {g}
              </th>
            ))}
            <th style={baslikHucre}>Toplam</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((o, i) => (
            <tr key={o?.student_id ?? `bos-${i}`} style={{ height: `${satirYuk}mm` }}>
              <td
                className="tabular-nums"
                style={{ ...hucre, textAlign: 'center', fontSize: `${Math.min(yazi, 3)}mm`, color: '#555' }}
              >
                {i + 1}
              </td>
              <td
                style={{
                  ...hucre,
                  paddingLeft: '1.5mm',
                  fontSize: `${yazi}mm`,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {o?.ad_soyad ?? ''}
              </td>
              {gunler.map((g) => (
                <td key={g} style={{ ...hucre, background: kapali(g) ? '#d1d5db' : undefined }} />
              ))}
              <td style={hucre} />
            </tr>
          ))}
        </tbody>
      </table>

      <footer
        className="mt-auto flex items-end justify-between"
        style={{ height: `${ALT_YUK}mm`, fontSize: '3mm', color: '#333' }}
      >
        <span>
          Koyu sütunlar hafta sonu ve tatil günleridir. Yeni kayıtlı öğrenciyi boş satıra yazın.
        </span>
        <span>Görevli imza: ______________________</span>
      </footer>
    </section>
  )
}
