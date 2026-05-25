import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import Providers from '@/app/providers'

import './globals.css'

export const metadata: Metadata = {
  title: 'SKU Ready Agent',
  description: 'SKU Ready Agent 主控台前端 UI 骨架',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
