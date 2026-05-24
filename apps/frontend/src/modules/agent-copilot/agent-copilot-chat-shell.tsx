'use client'

import { AgentAssistantThread } from './agent-assistant-thread'
import type { WorkbenchContext } from './types'

export function AgentCopilotChatShell({ context, compact = false }: { context: WorkbenchContext; compact?: boolean }) {
  return (
    <AgentAssistantThread
      compact={compact}
      context={context}
      description={context.pageTitle}
      title="Conversation"
    />
  )
}
