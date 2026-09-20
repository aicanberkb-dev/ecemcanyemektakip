import { YetkiYok } from '@/components/YetkiYok'
import { okulaBagliMi } from '@/lib/yetki'

export default async function MaliyetDuzeni({ children }: { children: React.ReactNode }) {
  if (await okulaBagliMi()) return <YetkiYok ekran="Maliyet" />
  return children
}
