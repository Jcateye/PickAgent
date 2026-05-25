import { fail, finalAgentRuntime, ok } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ missionId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { missionId } = await context.params
  try {
    return ok(finalAgentRuntime.agentService.getMission(missionId))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Agent mission not found')) {
      return fail('AGENT_MISSION.NOT_FOUND', error.message, 404, { missionId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent mission detail failed', 404, { missionId })
  }
}
