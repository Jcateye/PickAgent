import { fail, finalApiRuntime, ok, p0AuthContext } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  const plan = await finalApiRuntime.activityService.executionPlan(activityId, boundary)
  if (!plan) return fail('COMMON.VALIDATION_ERROR', 'activity not found', 404, { activityId }, boundary.requestId)
  return ok(plan, boundary.requestId)
}
