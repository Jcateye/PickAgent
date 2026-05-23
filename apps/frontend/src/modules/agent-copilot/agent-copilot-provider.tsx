'use client'

import { useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { AgentCopilotWorkbench } from './agent-copilot-workbench'
import type { WorkbenchContext } from './types'
import { WorkbenchContextProvider } from './workbench-context'

const defaultContext: WorkbenchContext = {
  route: '/dashboard',
  pageTitle: 'Dashboard 总览',
  selectedEntity: { entityType: 'dashboard', entityId: 'dashboard', label: 'Dashboard 总览' },
  visibleFilters: {},
  visibleColumns: ['status', 'risk', 'nextAction'],
}

export function AgentCopilotProvider({ children }: PropsWithChildren) {
  const [context, setContext] = useState<WorkbenchContext>(defaultContext)
  const [sidecarOpen, setSidecarOpen] = useState(false)
  const registry = useMemo(() => ({ context, setContext }), [context])

  return (
    <WorkbenchContextProvider value={registry}>
      {children}
      <button className="agentCopilotBubble" type="button" onClick={() => setSidecarOpen(true)} aria-label="Open Agent Copilot">
        Copilot
      </button>
      <aside className={`agentCopilotSidecar ${sidecarOpen ? 'agentCopilotSidecar--open' : ''}`} aria-hidden={!sidecarOpen}>
        <div className="agentCopilotSidecarHeader">
          <div>
            <strong>Agent Copilot</strong>
            <p>{context.pageTitle}</p>
          </div>
          <button className="iconButton" type="button" onClick={() => setSidecarOpen(false)} aria-label="Close Agent Copilot">
            x
          </button>
        </div>
        <div className="agentCopilotSidecarBody">
          <AgentCopilotWorkbench context={context} compact />
        </div>
      </aside>
    </WorkbenchContextProvider>
  )
}
