import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'
import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { createLocalPrismaConversationClient } from '../../../chat/local-prisma-client'

interface RouteContext {
  params: Promise<{ gateId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { gateId } = await context.params
  const payload = (await request.json().catch(() => null)) as { decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; decidedBy?: string; decisionComment?: string } | null
  if (!payload?.decision || !payload.decidedBy) return fail('COMMON.VALIDATION_ERROR', 'decision and decidedBy are required', 400)
  try {
    const repository = createConversationRepository()
    if (repository) {
      try {
        return ok(await repository.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment }))
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!message.includes('Agent review gate not found')) throw error
      }
    }
    return ok(finalAgentRuntime.agentService.decideReviewGate(gateId, { decision: payload.decision, decidedBy: payload.decidedBy, decisionComment: payload.decisionComment }))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent review gate decision failed', 400, { gateId })
  }
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
