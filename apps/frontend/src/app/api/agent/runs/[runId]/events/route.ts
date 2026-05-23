import { fail, finalAgentRuntime, ok, parsePositiveInt } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const after = parsePositiveInt(new URL(request.url).searchParams.get('after'), 0)
  try {
    return ok({ items: finalAgentRuntime.agentService.listEvents(runId, after), after })
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent event replay failed', 400, { runId, after })
  }
}
