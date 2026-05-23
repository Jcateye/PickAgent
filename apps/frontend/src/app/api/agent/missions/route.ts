import { fail, finalAgentRuntime, ok } from '../../_final-api-runtime'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { sessionKey?: string; objective?: string } | null
  if (!payload?.sessionKey || !payload.objective) return fail('COMMON.VALIDATION_ERROR', 'sessionKey and objective are required', 400)
  try {
    return ok(finalAgentRuntime.agentService.createMission({ ...payload, sessionKey: payload.sessionKey, objective: payload.objective }))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent mission creation failed', 400)
  }
}
