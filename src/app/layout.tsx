import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yemek Takip',
  description: 'Öğrenci yemek ve ödeme takip sistemi',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
