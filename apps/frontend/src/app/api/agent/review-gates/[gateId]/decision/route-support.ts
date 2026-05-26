import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'
import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { createLocalPrismaConversationClient } from '../../../chat/local-prisma-client'
import { executeApprovedChatReviewGateTool } from '../../../chat/route-support'

export { executeApprovedChatReviewGateTool } from '../../../chat/route-support'

interface RouteContext {
  params: Promise<{ gateId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { gateId } = await context.params
  const payload = (await request.json().catch(() => null)) as { decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; decidedBy?: string; decisionComment?: string } | null
  if (!payload?.decision || !payload.decidedBy) return fail('COMMON.VALIDATION_ERROR', 'decision and decidedBy are required', 400)
  try {
    const repository = isUuid(gateId) ? createConversationRepository() : null
    if (repository) {
      try {
        const decision = await repository.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment })
        return ok(await executeApprovedChatReviewGateTool(repository, decision))
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!message.includes('Agent review gate not found')) throw error
      }
    }
    return ok(finalAgentRuntime.agentService.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Agent review gate not found')) {
      return fail('AGENT_REVIEW_GATE.NOT_FOUND', error.message, 404, { gateId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent review gate decision failed', 400, { gateId })
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function createConversationRepository() {
  const local = createLocalPrismaConversationClient()
  if (local.client) return new PrismaAgentConversationRepository(local.client)

  try {
    const requireFromNode = eval('require') as (id: string) => { PrismaClient: new () => unknown }
    const { PrismaClient } = requireFromNode('@prisma/client')
    const prisma = new PrismaClient()
    assertAgentConversationPrismaClient(prisma)
    return new PrismaAgentConversationRepository(prisma)
  } catch {
    return undefined
  }
}
