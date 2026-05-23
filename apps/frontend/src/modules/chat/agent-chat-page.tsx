'use client'

import { AgentCopilotChatShell } from '@/modules/agent-copilot/agent-copilot-chat-shell'

const compatibleContext = {
  route: '/agent-chat',
  pageTitle: 'Agent Copilot 对话',
  selectedEntity: {
    entityType: 'dashboard' as const,
    entityId: 'agent-chat-root',
    label: 'Agent Copilot',
  },
  visibleFilters: {
    chatFirst: true,
  },
  visibleColumns: ['conversation', 'trace', 'evidence'],
}

export function AgentChatPage() {
  return <AgentCopilotChatShell context={compatibleContext} />
}
