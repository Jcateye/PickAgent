import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ runId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const payload = (await request.json().catch(() => ({}))) as { canceledBy?: string | null; reason?: string | null }
  try {
    return ok(finalAgentRuntime.agentService.cancelRun(runId, payload.canceledBy, payload.reason))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent run cancel failed', 400, { runId })
  }
}
