import { fail, finalApiRuntime, ok, p0AuthContext } from '../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { UpdateActivityRequestDto } from '../../../../../../contracts/types/activityManagement'

interface RouteContext {
  params: Promise<{ activityId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  try {
    const detail = await finalApiRuntime.activityService.detail(activityId, boundary)
    if (!detail) return activityNotFound(activityId, boundary.requestId)
    return ok(detail, boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return tenantBoundaryDenied(error, boundary.requestId)
    if (isActivityNotFound(error)) return activityNotFound(activityId, boundary.requestId)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity detail failed', 400, { activityId }, boundary.requestId)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const boundary = p0AuthContext(request)
  const { activityId } = await context.params
  const payload = (await request.json().catch(() => null)) as UpdateActivityRequestDto | null
  if (!payload) return fail('COMMON.VALIDATION_ERROR', 'request body is required', 400, undefined, boundary.requestId)
  try {
    return ok(await finalApiRuntime.activityService.update(activityId, payload, boundary), boundary.requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return tenantBoundaryDenied(error, boundary.requestId)
    if (isActivityNotFound(error)) return activityNotFound(activityId, boundary.requestId)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'activity update failed', 400, { activityId }, boundary.requestId)
  }
}

function isActivityNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Activity not found')
}

function activityNotFound(activityId: string, requestId?: string) {
  return fail('ACTIVITY.NOT_FOUND', 'activity not found', 404, { activityId }, requestId)
}

function tenantBoundaryDenied(error: P0AuthBoundaryError, requestId?: string) {
  return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit, requestId)
}
