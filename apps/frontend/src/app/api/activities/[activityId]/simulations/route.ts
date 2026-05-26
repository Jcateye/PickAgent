import { authFail, fail, finalApiRuntime, ok, p0AuthContext } from '../../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { SimulationRequestDto } from '../../../../../../../contracts/types/businessFoundation'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { activityId } = await context.params
  try {
    const boundary = p0AuthContext(request)
    const payload = (await request.json().catch(() => null)) as Omit<SimulationRequestDto, 'ruleSetId'> | null
    if (!payload?.skuProfileIds?.length) return fail('COMMON.VALIDATION_ERROR', 'skuProfileIds is required', 400, undefined, boundary.requestId)
    return ok(await finalApiRuntime.activityService.simulateForActivity(activityId, payload, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) {
      return authFail(error)
    }
    if (error instanceof Error && error.message.includes('Activity not found')) {
      return fail('ACTIVITY.NOT_FOUND', 'activity not found', 404, { activityId })
    }
    if (error instanceof Error && error.message.includes('Activity rule set is required')) {
      return fail('ACTIVITY.CONFLICT', error.message, 409, { activityId })
    }
    if (error instanceof Error && error.message.includes('SKU detail not found for simulation')) {
      return fail('SKU.NOT_FOUND', error.message, 404, { activityId })
    }
    if (error instanceof Error && error.message.includes('Rule set is disabled')) {
      return fail('RULE.CONFLICT', error.message, 409, { activityId })
    }
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity simulation failed', 400, { activityId })
  }
}
