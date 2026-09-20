import { YetkiYok } from '@/components/YetkiYok'
import { okulaBagliMi } from '@/lib/yetki'

export default async function YedekDuzeni({ children }: { children: React.ReactNode }) {
  if (await okulaBagliMi()) return <YetkiYok ekran="Yedek" />
  return children
}
