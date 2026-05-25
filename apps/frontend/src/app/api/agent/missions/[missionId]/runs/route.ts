import { fail, finalAgentRuntime, ok } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ missionId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { missionId } = await context.params
  const payload = ((await request.json().catch(() => ({}))) ?? {}) as { modelProvider?: string | null; modelName?: string | null; inputJson?: Record<string, unknown>; timeoutMs?: number | null }
  try {
    return ok(finalAgentRuntime.agentService.startRun(missionId, payload))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Agent mission not found')) {
      return fail('AGENT_MISSION.NOT_FOUND', error.message, 404, { missionId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent run creation failed', 400, { missionId })
  }
}
