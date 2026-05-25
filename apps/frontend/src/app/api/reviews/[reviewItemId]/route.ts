import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../_final-api-runtime'

import type { ReviewItemDto } from '../../../../../../contracts/types/businessFoundation'

interface RouteContext {
  params: Promise<{ reviewItemId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { reviewItemId } = await context.params
  const detail = await finalApiRuntime.reviewService.getDetail(reviewItemId, authContextFromRequest(request))
  if (!detail) return fail('REVIEW.NOT_FOUND', 'Review item not found', 404, { reviewItemId })
  return ok(detail)
}

export async function PATCH(request: Request, context: RouteContext) {
  const { reviewItemId } = await context.params
  const payload = (await request.json().catch(() => null)) as Partial<Pick<ReviewItemDto, 'question' | 'recommendation' | 'riskLevel'>> | null
  if (!payload || typeof payload !== 'object') return fail('COMMON.VALIDATION_ERROR', 'patch payload is required', 400)
  try {
    return ok(await finalApiRuntime.reviewService.update(reviewItemId, payload, authContextFromRequest(request)))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review item update failed'
    if (message.includes('not pending')) return fail('REVIEW.CONFLICT', message, 409, { reviewItemId })
    return fail('REVIEW.NOT_FOUND', message, 404, { reviewItemId })
  }
}
