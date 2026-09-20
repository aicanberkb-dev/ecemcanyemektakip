import { YetkiYok } from '@/components/YetkiYok'
import { okulaBagliMi } from '@/lib/yetki'

export default async function AyarlarDuzeni({ children }: { children: React.ReactNode }) {
  if (await okulaBagliMi()) return <YetkiYok ekran="Ayarlar" />
  return children
}
