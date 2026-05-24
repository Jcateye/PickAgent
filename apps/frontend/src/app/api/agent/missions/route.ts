import { fail, finalAgentRuntime, ok } from '../../_final-api-runtime'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') ?? '1')
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20')
  const status = url.searchParams.get('status') ?? undefined
  try {
    return ok(finalAgentRuntime.agentService.listMissions({ page, pageSize, status }))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent mission list failed', 400)
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { sessionKey?: string; objective?: string } | null
  if (!payload?.sessionKey || !payload.objective) return fail('COMMON.VALIDATION_ERROR', 'sessionKey and objective are required', 400)
  try {
    return ok(finalAgentRuntime.agentService.createMission({ ...payload, sessionKey: payload.sessionKey, objective: payload.objective }))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Agent mission creation failed', 400)
  }
}
