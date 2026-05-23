import type { ReactNode } from 'react'

import { ConsoleLayout } from '@/app/layouts/console-layout'

export default function ConsoleRouteLayout({ children }: { children: ReactNode }) {
  return <ConsoleLayout>{children}</ConsoleLayout>
}
