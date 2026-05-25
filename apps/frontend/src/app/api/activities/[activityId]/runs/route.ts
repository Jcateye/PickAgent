import { fail, finalApiRuntime, ok, p0AuthContext } from '../../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  try {
    return ok(await finalApiRuntime.activityService.startRun(activityId, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Activity not found')) {
      return fail('ACTIVITY.NOT_FOUND', 'activity not found', 404, { activityId }, boundary.requestId)
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity run failed', 400, { activityId }, boundary.requestId)
  }
}
