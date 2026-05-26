import { authFail, fail, finalApiRuntime, ok, p0AuthContext } from '../../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { ActivityCandidateSkuRequestDto } from '../../../../../../../contracts/types/activityManagement'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { activityId } = await context.params
  try {
    const boundary = p0AuthContext(request)
    const payload = (await request.json().catch(() => null)) as ActivityCandidateSkuRequestDto | null
    if (!payload) return fail('COMMON.VALIDATION_ERROR', 'request body is required', 400, undefined, boundary.requestId)
    return ok(await finalApiRuntime.activityService.addCandidateSkus(activityId, payload.skuProfileIds, {
      reasonCode: payload.reasonCode,
      comment: payload.comment,
    }, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) {
      return authFail(error)
    }
    if (error instanceof Error && error.message.includes('Activity not found')) {
      return fail('ACTIVITY.NOT_FOUND', 'activity not found', 404, { activityId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'candidate sku update failed', 400, { activityId })
  }
}
