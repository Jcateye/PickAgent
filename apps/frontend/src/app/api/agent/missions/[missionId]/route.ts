import { fail, finalAgentRuntime, ok } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ missionId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { missionId } = await context.params
  try {
    return ok(finalAgentRuntime.agentService.getMission(missionId))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent mission detail failed', 404, { missionId })
  }
}
