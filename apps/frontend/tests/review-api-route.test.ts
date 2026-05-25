import assert from 'node:assert/strict'
import test from 'node:test'

import { finalApiRuntime } from '../src/app/api/_final-api-runtime'
import { PATCH as patchReview } from '../src/app/api/reviews/[reviewItemId]/route'
import { POST as decideReview } from '../src/app/api/reviews/[reviewItemId]/decision/route'

const boundary = {
  actorId: 'review_route_tester',
  tenantId: 'dev_tenant',
  sessionId: 'review_route_session',
  surface: 'route-test',
  requestId: 'review_route_request',
}

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': boundary.actorId,
  'x-p0-tenant-id': boundary.tenantId,
  'x-p0-session-id': boundary.sessionId,
  'x-p0-surface': boundary.surface,
  'x-request-id': boundary.requestId,
}

test('review routes return conflict when closed review is edited or decided again', async () => {
  const [review] = await finalApiRuntime.reviewService.create([
    {
      sourceType: 'agent',
      sourceId: `review_route_source_${Date.now()}`,
      question: '是否允许继续推进该建议？',
      recommendation: '先人工确认，再继续推进。',
      riskLevel: 'L1',
      evidence: [],
    },
  ], boundary)

  const decisionResponse = await decideReview(
    new Request(`http://localhost/api/reviews/${review.reviewItemId}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'APPROVE', decisionBy: boundary.actorId }),
    }),
    { params: Promise.resolve({ reviewItemId: review.reviewItemId }) },
  )
  assert.equal(decisionResponse.status, 200)

  const patchResponse = await patchReview(
    new Request(`http://localhost/api/reviews/${review.reviewItemId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ recommendation: '审批后不应再修改。' }),
    }),
    { params: Promise.resolve({ reviewItemId: review.reviewItemId }) },
  )
  const patchEnvelope = await patchResponse.json()
  assert.equal(patchResponse.status, 409)
  assert.equal(patchEnvelope.code, 'REVIEW.CONFLICT')

  const secondDecisionResponse = await decideReview(
    new Request(`http://localhost/api/reviews/${review.reviewItemId}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'REJECT', decisionBy: boundary.actorId }),
    }),
    { params: Promise.resolve({ reviewItemId: review.reviewItemId }) },
  )
  const secondDecisionEnvelope = await secondDecisionResponse.json()
  assert.equal(secondDecisionResponse.status, 409)
  assert.equal(secondDecisionEnvelope.code, 'REVIEW.CONFLICT')
})
