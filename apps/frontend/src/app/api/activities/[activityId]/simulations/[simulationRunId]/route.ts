import { authFail, fail, finalApiRuntime, ok, p0AuthContext } from '../../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface RouteContext {
  params: Promise<{ activityId: string; simulationRunId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { activityId, simulationRunId } = await context.params
  try {
    const boundary = p0AuthContext(request)
    const detail = await finalApiRuntime.activityService.simulationDetail(activityId, simulationRunId, boundary)
    if (!detail) return fail('ACTIVITY_SIMULATION.NOT_FOUND', 'simulation run not found', 404, { activityId, simulationRunId }, boundary.requestId)
    return ok(detail, boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity simulation detail failed', 400, { activityId, simulationRunId })
  }
}
