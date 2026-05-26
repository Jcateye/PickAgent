import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { ReviewItemDto } from '../../../../../../contracts/types/businessFoundation'

interface RouteContext {
  params: Promise<{ reviewItemId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reviewItemId } = await context.params
  try {
    const detail = await finalApiRuntime.reviewService.getDetail(reviewItemId, authContextFromRequest(request))
    if (!detail) return fail('REVIEW.NOT_FOUND', 'Review item not found', 404, { reviewItemId })
    return ok(detail)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    return fail('REVIEW.NOT_FOUND', error instanceof Error ? error.message : 'Review item not found', 404, { reviewItemId })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { reviewItemId } = await context.params
  const payload = (await request.json().catch(() => null)) as Partial<Pick<ReviewItemDto, 'question' | 'recommendation' | 'riskLevel'>> | null
  if (!payload || typeof payload !== 'object') return fail('COMMON.VALIDATION_ERROR', 'patch payload is required', 400)
  try {
    return ok(await finalApiRuntime.reviewService.update(reviewItemId, payload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit)
    const message = error instanceof Error ? error.message : 'Review item update failed'
    if (message.includes('not pending')) return fail('REVIEW.CONFLICT', message, 409, { reviewItemId })
    return fail('REVIEW.NOT_FOUND', message, 404, { reviewItemId })
  }
}
