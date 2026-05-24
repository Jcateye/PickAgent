import { fail, finalAgentRuntime, ok } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params
  try {
    return ok(finalAgentRuntime.agentService.getRun(runId))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent run detail failed', 404, { runId })
  }
}
