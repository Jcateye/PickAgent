import { fail, ok } from '../../_final-api-runtime'

import { REAL_AGENT_CHAT_NOT_CONFIGURED, RealAgentChatConfigurationError, RealAgentChatRuntime } from '../../../../../../backend/src/application/foundation/RealAgentChatRuntime'

import type { AgentEvidenceRef, AgentLinkedEntity, AgentMessage, AgentReviewGate, AgentToolTrace, WorkbenchContext } from '@/modules/agent-copilot/types'

interface ChatRequest {
  sessionKey?: string
  message?: string
  context?: WorkbenchContext
}

interface ChatResponse {
  missionId: string
  runId: string
  assistantMessage: AgentMessage
  toolTrace: AgentToolTrace[]
  evidenceRefs: AgentEvidenceRef[]
  linkedEntities: AgentLinkedEntity[]
  reviewGate: AgentReviewGate | null
  fallbackUsed: false
}

const realAgentChatRuntime = new RealAgentChatRuntime({})

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ChatRequest | null
  const message = payload?.message?.trim()
  const sessionKey = payload?.sessionKey?.trim()

  if (!sessionKey || !message) {
    return fail('COMMON.VALIDATION_ERROR', 'sessionKey and message are required', 400)
  }

  try {
    const result = await realAgentChatRuntime.sendMessage({
      sessionKey,
      message,
      context: payload?.context,
    })

    return ok<ChatResponse>({
      missionId: result.mission.id,
      runId: result.run.id,
      assistantMessage: {
        id: result.assistantMessage.id,
        role: 'assistant',
        content: result.assistantMessage.contentText ?? '',
        status: result.assistantMessage.status === 'completed' ? 'completed' : 'streaming',
        linkedEntityIds: [],
        evidenceRefIds: [],
      },
      toolTrace: [],
      evidenceRefs: [],
      linkedEntities: [],
      reviewGate: null,
      fallbackUsed: false,
    })
  } catch (error) {
    if (error instanceof RealAgentChatConfigurationError) {
      return fail(
        REAL_AGENT_CHAT_NOT_CONFIGURED,
        'Real Agent chat requires persistent conversation storage and a model adapter before it can answer.',
        503,
        { missing: error.missing },
      )
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent chat request failed', 400)
  }
}
