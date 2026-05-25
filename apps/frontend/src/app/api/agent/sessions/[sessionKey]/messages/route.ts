import { fail, ok, parsePositiveInt } from '../../../../_final-api-runtime'

import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { createLocalPrismaConversationClient } from '../../../chat/local-prisma-client'
import { toRecoveredTurn } from '../../recovered-turn'

interface RouteContext {
  params: Promise<{ sessionKey: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { sessionKey } = await context.params
  const url = new URL(request.url)
  const limit = parsePositiveInt(url.searchParams.get('limit'), 50)
  const repository = createConversationRepository()
  if (!repository) {
    return fail('AGENT.REAL_CHAT_NOT_CONFIGURED', 'Agent conversation storage is not configured.', 503, { missing: ['AgentConversationRepository'] })
  }

  try {
    const messages = await repository.listMessagesBySessionKey(decodeURIComponent(sessionKey), Math.min(limit, 100))
    return ok({
      items: messages.map((message) => ({
        id: message.id,
        role: message.role.toLowerCase(),
        content: message.contentText ?? '',
        status: message.status === 'completed' || message.status === 'COMPLETED' ? 'completed' : 'streaming',
        runId: message.runId,
        createdAt: message.createdAt,
        turn: toRecoveredTurn(message.contentJson, message.runId),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent session message recovery failed'
    if (message.includes("Can't reach database server") || message.includes('ECONNREFUSED')) {
      return ok({ items: [] })
    }
    return fail('COMMON.VALIDATION_ERROR', message, 400, { sessionKey })
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
