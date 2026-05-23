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
      const body = items.map((event) => `id: ${event.sequence}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`).join('')
      return new Response(body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
        },
      })
    }
    return ok({ items, after })
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent event replay failed', 400, { runId, after })
  }
}
