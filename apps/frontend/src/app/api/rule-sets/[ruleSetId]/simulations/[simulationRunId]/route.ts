import { fail, finalApiRuntime, ok, p0AuthContext } from '../../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ ruleSetId: string; simulationRunId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { ruleSetId, simulationRunId } = await context.params
  const run = await finalApiRuntime.activityService.simulationRunForRuleSet(ruleSetId, simulationRunId, boundary)
  if (!run) return fail('ACTIVITY_SIMULATION.NOT_FOUND', 'simulation run not found', 404, { ruleSetId, simulationRunId }, boundary.requestId)
  return ok(run, boundary.requestId)
}
