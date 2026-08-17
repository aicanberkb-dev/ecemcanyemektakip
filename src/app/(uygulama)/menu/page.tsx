import Link from 'next/link'

import { AY_ADLARI } from '@/lib/format'
import { aktifOkul } from '@/lib/okul'
import { supabaseServer } from '@/lib/supabase/server'

import { MenuEkrani, type HavuzKaydi, type MenuGunu } from './MenuEkrani'
import { MenuKopyalaFormu } from './MenuKopyalaFormu'

export const metadata = { title: 'Yemek Listesi — Yemek Takip' }

type Liste = {
  id: string
  ad: string
  havuz_grubu: string
  okul_id: string | null
  satir_sayisi: number
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ yil?: string; ay?: string; liste?: string }>
}) {
  const q = await searchParams
  const simdi = new Date()
  const yil = Number(q.yil) || simdi.getFullYear()
  const ay = Number(q.ay) || simdi.getMonth() + 1

  // Genel modda okul seçili değil: bütün listeler görünür. Bir okul
  // seçiliyken o okulun listesi + bağımsız listeler görünür.
  const okul = await aktifOkul()

  const supabase = await supabaseServer()

  const { data: listeVeri } = await supabase
    .from('menu_listeleri')
    .select('id, ad, havuz_grubu, okul_id, satir_sayisi')
    .eq('aktif', true)
    .order('sira')

  const tumListeler = (listeVeri ?? []) as Liste[]

  const listeler = okul
    ? tumListeler.filter((l) => l.okul_id === null || l.okul_id === okul.id)
    : tumListeler
  if (listeler.length === 0) return null

  const secili =
    listeler.find((l) => l.id === q.liste) ??
    (okul ? listeler.find((l) => l.okul_id === okul.id) : undefined) ??
    listeler[0]

  const bas = `${yil}-${String(ay).padStart(2, '0')}-01`
  const bit = `${yil}-${String(ay).padStart(2, '0')}-${new Date(yil, ay, 0).getDate()}`

  const [{ data: menuVeri }, { data: havuzVeri }] = await Promise.all([
    supabase
      .from('menu_gunleri')
      .select('tarih, corba, ana_yemek, yardimci, ek')
      .eq('liste_id', secili.id)
      .gte('tarih', bas)
      .lte('tarih', bit)
      .order('tarih'),
    supabase.rpc('yemek_havuzu', { p_liste_id: secili.id }),
  ])

  const menu = (menuVeri ?? []) as MenuGunu[]
  const havuz = (havuzVeri ?? []) as HavuzKaydi[]

  // Kopyalama kaynağı olarak aynı havuz grubundaki listeler anlamlı
  const kopyaKaynaklari = tumListeler.filter((l) => l.havuz_grubu === secili.havuz_grubu)

  const bag = (l: string) =>
    `/menu?liste=${encodeURIComponent(l)}&yil=${yil}&ay=${ay}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="baslik">Yemek Listesi</h1>
          <p className="text-sm text-solgun">
            Aylık menü. Girilen menü gün sonu raporunda görünür ve{' '}
            <Link href="/reports/yemek" className="text-vurgu hover:underline">
              hangi yemeğe kaç kişi geldiği
            </Link>{' '}
            buradan hesaplanır.
          </p>
        </div>
        <span
          className={`rozet ${
            okul ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'
          }`}
        >
          {okul?.ad ?? 'GENEL'}
        </span>
      </div>

      {/* Liste seçimi */}
      <div className="flex flex-wrap gap-2">
        {listeler.map((l) => (
          <Link
            key={l.id}
            href={bag(l.id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              l.id === secili.id
                ? 'border-vurgu bg-vurgu font-semibold text-white'
                : 'border-cizgi bg-white hover:bg-slate-50'
            }`}
          >
            {l.ad}
            {l.havuz_grubu === 'tasimali' && (
              <span className="ml-1.5 text-xs opacity-70">3 satır</span>
            )}
          </Link>
        ))}
      </div>

      <div className="kart flex flex-wrap items-end gap-3 p-4">
        <form className="flex items-end gap-2">
          <input type="hidden" name="liste" value={secili.id} />
          <div>
            <label className="etiket" htmlFor="ay">
              Ay
            </label>
            <select id="ay" name="ay" defaultValue={String(ay)} className="girdi">
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
              defaultValue={yil}
              min={2000}
              max={2100}
              className="girdi w-28"
            />
          </div>
          <button className="btn-birincil">Göster</button>
        </form>

        <MenuKopyalaFormu
          hedefListeId={secili.id}
          hedefYil={yil}
          hedefAy={ay}
          kaynaklar={kopyaKaynaklari.map((l) => ({ id: l.id, ad: l.ad }))}
        />

        <Link
          href={`/menu/cikti?liste=${secili.id}&yil=${yil}&ay=${ay}`}
          target="_blank"
          className="btn-ikincil ml-auto"
        >
          Çıktı / Afiş
        </Link>
      </div>

      <MenuEkrani
        key={`${secili.id}-${yil}-${ay}`}
        listeId={secili.id}
        satirSayisi={secili.satir_sayisi ?? 4}
        yil={yil}
        ay={ay}
        menu={menu}
        havuz={havuz}
      />
    </div>
  )
}
