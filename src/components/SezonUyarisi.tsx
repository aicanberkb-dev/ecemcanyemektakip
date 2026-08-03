import { tarih as tarihBicim } from '@/lib/format'
import type { Sezon, TaksitPlani } from '@/lib/types'

/**
 * Sezona tarih aralığı verilmişse, aralık dışında kalan taksit veya bugünün
 * tarihi tahsilatın sayılmamasına yol açar; bu sessiz bir hatadır (öğrenci
 * ödediği halde borçlu görünür). Tarih verilmemişse filtre yoktur, uyarı da yok.
 */
export function SezonUyarisi({ sezon, plan }: { sezon: Sezon; plan: TaksitPlani[] }) {
  // Tarih tanımlı değilse filtre uygulanmıyor demektir; uyarılacak bir şey yok
  if (!sezon.baslangic && !sezon.bitis) return null

  const disarida = plan.filter(
    (t) =>
      (sezon.baslangic && t.vade_tarihi < sezon.baslangic) ||
      (sezon.bitis && t.vade_tarihi > sezon.bitis),
  )

  const bugun = new Date().toISOString().slice(0, 10)
  const bugunDisarida =
    (!!sezon.baslangic && bugun < sezon.baslangic) || (!!sezon.bitis && bugun > sezon.bitis)

  if (disarida.length === 0 && !bugunDisarida) return null

  const aralik = `${sezon.baslangic ? tarihBicim(sezon.baslangic) : 'başlangıçsız'} – ${
    sezon.bitis ? tarihBicim(sezon.bitis) : 'bitişsiz'
  }`

  return (
    <div className="yazdirma-gizle rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Sezon tarihlerini kontrol edin</p>

      {disarida.length > 0 && (
        <p className="mt-1">
          Şu taksitlerin vadesi sezon aralığının ({aralik}) dışında:{' '}
          <strong>
            {disarida.map((t) => `${t.ad} (${tarihBicim(t.vade_tarihi)})`).join(', ')}
          </strong>
          .
        </p>
      )}

      {bugunDisarida && (
        <p className="mt-1">
          Bugünün tarihi sezon aralığının dışında.{' '}
          <strong>Bugün girilen tahsilat bu sezona sayılmaz</strong> ve öğrenci ödediği
          halde borçlu görünür.
        </p>
      )}

      <p className="mt-2 text-xs">
        Ayarlar sayfasından tarihleri düzeltebilir ya da tamamen boşaltarak tarih
        filtresini kaldırabilirsiniz — o zaman öğrencinin tüm tahsilatı sayılır.
      </p>
    </div>
  )
}
