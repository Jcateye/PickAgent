import { authFail, fail, finalApiRuntime, ok, p0AuthContext } from '../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { activityId } = await context.params
  try {
    const boundary = p0AuthContext(request)
    return ok(await finalApiRuntime.activityService.startRun(activityId, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) {
      return authFail(error)
    }
    if (error instanceof Error && error.message.includes('Activity not found')) {
      return fail('ACTIVITY.NOT_FOUND', 'activity not found', 404, { activityId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity run failed', 400, { activityId })
  }
}
