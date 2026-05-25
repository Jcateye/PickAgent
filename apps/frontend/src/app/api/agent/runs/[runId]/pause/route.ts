import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const payload = (await request.json().catch(() => ({}))) as { pausedBy?: string | null }
  try {
    return ok(finalAgentRuntime.agentService.pauseRun(runId, payload.pausedBy))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Agent run not found')) {
      return fail('AGENT_RUN.NOT_FOUND', error.message, 404, { runId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent run pause failed', 400, { runId })
  }
}
