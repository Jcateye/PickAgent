import { authFail, fail, finalApiRuntime, ok, p0AuthContext } from '../../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface RouteContext {
  params: Promise<{ ruleSetId: string; simulationRunId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { ruleSetId, simulationRunId } = await context.params
  try {
    const boundary = p0AuthContext(request)
    const run = await finalApiRuntime.activityService.simulationRunForRuleSet(ruleSetId, simulationRunId, boundary)
    if (!run) return fail('ACTIVITY_SIMULATION.NOT_FOUND', 'simulation run not found', 404, { ruleSetId, simulationRunId }, boundary.requestId)
    return ok(run, boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'rule set simulation detail failed', 400, { ruleSetId, simulationRunId })
  }
}
