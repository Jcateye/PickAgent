'use client'

import { AgentCopilotWorkbench } from '@/modules/agent-copilot/agent-copilot-workbench'

const compatibleContext = {
  route: '/agent-chat',
  pageTitle: 'Agent Chat 兼容入口',
  selectedEntity: {
    entityType: 'dashboard' as const,
    entityId: 'agent-chat-compatible-entry',
    label: 'Agent Chat 兼容入口',
  },
  visibleFilters: {
    compatibilityMode: true,
  },
  visibleColumns: ['mission', 'plan', 'trace', 'context', 'reviewGate'],
}

export function AgentChatPage() {
  return <AgentCopilotWorkbench context={compatibleContext} />
}
