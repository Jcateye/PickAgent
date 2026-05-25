import { authContextFromRequest, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

import type { ReviewDecisionRequestDto } from '../../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

interface RouteContext {
  params: Promise<{ reviewItemId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { reviewItemId } = await context.params
  const payload = (await request.json().catch(() => null)) as ReviewDecisionRequestDto | null
  if (!payload?.decision || !payload.decisionBy) return fail('COMMON.VALIDATION_ERROR', 'decision and decisionBy are required', 400)
  try {
    return ok(await finalApiRuntime.reviewService.decide(reviewItemId, payload, authContextFromRequest(request)))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Review item decision failed'
    if (message.includes('not pending')) return fail('REVIEW.CONFLICT', message, 409, { reviewItemId })
    return fail('REVIEW.NOT_FOUND', message, 404, { reviewItemId })
  }
}
