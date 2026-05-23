import type { PropsWithChildren } from 'react'

import { AgentCopilotProvider } from '@/modules/agent-copilot/agent-copilot-provider'
import { SidebarNav } from '@/shared/ui/sidebar-nav'
import { Topbar } from '@/shared/ui/topbar'

export function ConsoleLayout({ children }: PropsWithChildren) {
  return (
    <AgentCopilotProvider>
      <div className="appShell">
        <SidebarNav />
        <div className="mainShell">
          <Topbar />
          <main className="contentShell">{children}</main>
        </div>
      </div>
    </AgentCopilotProvider>
  )
}
