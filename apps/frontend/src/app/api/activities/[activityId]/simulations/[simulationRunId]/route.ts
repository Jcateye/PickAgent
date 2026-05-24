import { fail, finalApiRuntime, ok, p0AuthContext } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ activityId: string; simulationRunId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId, simulationRunId } = await context.params
  const detail = await finalApiRuntime.activityService.simulationDetail(activityId, simulationRunId, boundary)
  if (!detail) return fail('COMMON.VALIDATION_ERROR', 'simulation run not found', 404, { activityId, simulationRunId }, boundary.requestId)
  return ok(detail, boundary.requestId)
}
