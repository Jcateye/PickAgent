import { fail, finalAgentRuntime, ok, parsePositiveInt } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const url = new URL(request.url)
  const after = parsePositiveInt(url.searchParams.get('after'), 0)
  try {
    const items = finalAgentRuntime.agentService.listEvents(runId, after)
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
            const nextItems = finalAgentRuntime.agentService.listEvents(runId, cursor)
            nextItems.forEach(send)
            if (Date.now() - startedAt > 30000) {
              clearInterval(interval)
              controller.close()
            }
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
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent event replay failed', 400, { runId, after })
  }
}
