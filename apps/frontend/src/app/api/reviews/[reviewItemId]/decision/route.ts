import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { ReviewDecisionRequestDto } from '../../../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

interface RouteContext {
  params: Promise<{ reviewItemId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { reviewItemId } = await context.params
  const payload = (await request.json().catch(() => null)) as (Omit<ReviewDecisionRequestDto, 'decision'> & { decision?: string }) | null
  if (!payload?.decision || !payload.decisionBy) return fail('COMMON.VALIDATION_ERROR', 'decision and decisionBy are required', 400)
  const requestPayload: ReviewDecisionRequestDto = {
    ...payload,
    decision: normalizeReviewDecision(payload.decision),
  }
  try {
    return ok(await finalApiRuntime.reviewService.decide(reviewItemId, requestPayload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    const message = error instanceof Error ? error.message : 'Review item decision failed'
    if (message.includes('not pending')) return fail('REVIEW.CONFLICT', message, 409, { reviewItemId })
    return fail('REVIEW.NOT_FOUND', message, 404, { reviewItemId })
  }
}

function normalizeReviewDecision(value: string): ReviewDecisionRequestDto['decision'] {
  if (value === 'REJECT') return 'REJECT'
  if (value === 'REQUEST_CHANGES' || value === 'MODIFIED' || value === 'CHANGES_REQUESTED') return 'REQUEST_CHANGES'
  return 'APPROVE'
}
