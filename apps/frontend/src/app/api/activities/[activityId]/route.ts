import { fail, finalApiRuntime, ok, p0AuthContext } from '../../_final-api-runtime'

import type { UpdateActivityRequestDto } from '../../../../../../contracts/types/activityManagement'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  const detail = await finalApiRuntime.activityService.detail(activityId, boundary)
  if (!detail) return fail('COMMON.VALIDATION_ERROR', 'activity not found', 404, { activityId }, boundary.requestId)
  return ok(detail, boundary.requestId)
}

export async function PATCH(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  const payload = (await request.json().catch(() => null)) as UpdateActivityRequestDto | null
  if (!payload) return fail('COMMON.VALIDATION_ERROR', 'request body is required', 400, undefined, boundary.requestId)
  try {
    return ok(await finalApiRuntime.activityService.update(activityId, payload, boundary), boundary.requestId)
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity update failed', 400, { activityId }, boundary.requestId)
  }
}
