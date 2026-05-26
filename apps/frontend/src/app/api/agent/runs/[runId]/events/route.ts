import { fail, finalAgentRuntime, ok, parsePositiveInt } from '../../../../_final-api-runtime'

import { assertAgentConversationPrismaClient, PrismaAgentConversationRepository } from '../../../../../../../../backend/src/application/foundation/PrismaAgentConversationRepository'
import { createLocalPrismaConversationClient } from '../../../chat/local-prisma-client'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const url = new URL(request.url)
  const after = parsePositiveInt(url.searchParams.get('after'), 0)
  try {
    finalAgentRuntime.agentService.getRun(runId)
    const repository = createConversationRepository()
    const listEvents = async (cursor: number) => {
      if (!repository) return finalAgentRuntime.agentService.listEvents(runId, cursor)
      try {
        return await repository.listEventsAfter(runId, cursor)
      } catch {
        return finalAgentRuntime.agentService.listEvents(runId, cursor)
      }
    }
    const items = await listEvents(after)
    const wantsStream = url.searchParams.get('stream') === '1' || request.headers.get('accept')?.includes('text/event-stream')
    if (wantsStream) {
      const encoder = new TextEncoder()
      let cursor = after
      const body = new ReadableStream({
        async start(controller) {
          const send = (event: (typeof items)[number]) => {
            cursor = Math.max(cursor, event.sequence)
            controller.enqueue(encoder.encode(`id: ${event.sequence}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`))
          }
          items.forEach(send)
          const startedAt = Date.now()
          const interval = setInterval(() => {
            void listEvents(cursor).then((nextItems) => {
              nextItems.forEach(send)
              const terminal = nextItems.some((event) => event.eventType === 'run.status_changed' && ['DONE', 'FAILED', 'CANCELED', 'SUCCEEDED'].includes(String(event.eventPhase)))
              if (terminal || Date.now() - startedAt > 30000) {
                clearInterval(interval)
                controller.close()
              }
            }).catch((error) => {
              clearInterval(interval)
              controller.error(error)
            })
          }, 1000)
        },
      })
      return new Response(body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          Connection: 'keep-alive',
        },
      })
    }
    return ok({ items, after })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Agent run not found')) {
      return fail('AGENT_RUN.NOT_FOUND', error.message, 404, { runId, after })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent event replay failed', 400, { runId, after })
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
