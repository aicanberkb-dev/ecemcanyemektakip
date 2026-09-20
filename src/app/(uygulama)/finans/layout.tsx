import { YetkiYok } from '@/components/YetkiYok'
import { okulaBagliMi } from '@/lib/yetki'

export default async function FinansDuzeni({ children }: { children: React.ReactNode }) {
  if (await okulaBagliMi()) return <YetkiYok ekran="Finans" />
  return children
}
