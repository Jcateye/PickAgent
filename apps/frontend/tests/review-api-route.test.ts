import assert from 'node:assert/strict'
import test from 'node:test'

import { finalApiRuntime } from '../src/app/api/_final-api-runtime'
import { GET as listReviews, POST as createReviews } from '../src/app/api/reviews/route'
import { GET as getReview, PATCH as patchReview } from '../src/app/api/reviews/[reviewItemId]/route'
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

const otherTenantHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'review_route_other_tenant',
  'x-p0-tenant-id': 'other_tenant',
  'x-p0-session-id': 'review_route_other_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'review_route_other_request',
}

test('review routes return stable auth envelopes when P0 context is missing', async () => {
  const reviewItemId = 'missing_auth_review'
  const responses = await Promise.all([
    listReviews(new Request('http://localhost/api/reviews')),
    createReviews(new Request('http://localhost/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ sourceType: 'agent', sourceId: 'missing_auth', question: 'q', recommendation: 'r', riskLevel: 'L1', evidence: [] }] }),
    })),
    getReview(new Request(`http://localhost/api/reviews/${reviewItemId}`), { params: Promise.resolve({ reviewItemId }) }),
    patchReview(new Request(`http://localhost/api/reviews/${reviewItemId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recommendation: 'missing auth patch' }),
    }), { params: Promise.resolve({ reviewItemId }) }),
    decideReview(new Request(`http://localhost/api/reviews/${reviewItemId}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'APPROVE', decisionBy: 'missing_auth' }),
    }), { params: Promise.resolve({ reviewItemId }) }),
  ])

  for (const response of responses) {
    const envelope = await response.json()
    assert.equal(response.status, 401)
    assert.equal(envelope.code, 'COMMON.VALIDATION_ERROR')
  }
})

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

test('review route creates then approves item that appears in approved workbench tab', async () => {
  const sourceId = `review_route_approved_${Date.now()}`
  const createResponse = await createReviews(
    new Request('http://localhost/api/reviews', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [
          {
            sourceType: 'agent',
            sourceId,
            question: '批量确认检查项已完成？',
            recommendation: '规则执行页批量确认后应进入已批准列表。',
            riskLevel: 'L1',
            evidence: [],
          },
        ],
      }),
    }),
  )
  const createEnvelope = await createResponse.json()
  assert.equal(createResponse.status, 200)
  const reviewItemId = createEnvelope.data[0].reviewItemId

  const decisionResponse = await decideReview(
    new Request(`http://localhost/api/reviews/${reviewItemId}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'APPROVE', decisionBy: boundary.actorId, decisionComment: '路由测试批准' }),
    }),
    { params: Promise.resolve({ reviewItemId }) },
  )
  assert.equal(decisionResponse.status, 200)

  const approvedResponse = await listReviews(new Request('http://localhost/api/reviews?tab=APPROVED&pageSize=50', { headers: authHeaders }))
  const approvedEnvelope = await approvedResponse.json()
  assert.equal(approvedResponse.status, 200)
  assert.ok(approvedEnvelope.data.items.some((item: { reviewItemId: string; status: string }) => item.reviewItemId === reviewItemId && item.status === 'APPROVED'))
})

test('review list route applies assignee role and due date filters', async () => {
  const sourceId = `review_route_due_filter_${Date.now()}`
  const createResponse = await createReviews(
    new Request('http://localhost/api/reviews', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [
          {
            sourceType: 'agent',
            sourceId,
            question: '筛选后的审批项是否可复现？',
            recommendation: '该审批项用于验证负责人和时间窗口过滤。',
            riskLevel: 'L1',
            evidence: [],
          },
        ],
      }),
    }),
  )
  const createEnvelope = await createResponse.json()
  assert.equal(createResponse.status, 200)
  const reviewItemId = createEnvelope.data[0].reviewItemId

  const beforeDecision = new Date(Date.now() - 1000).toISOString()
  const decisionResponse = await decideReview(
    new Request(`http://localhost/api/reviews/${reviewItemId}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'REQUEST_CHANGES', decisionBy: boundary.actorId, decisionComment: '路由测试修改后批准' }),
    }),
    { params: Promise.resolve({ reviewItemId }) },
  )
  assert.equal(decisionResponse.status, 200)
  const afterDecision = new Date(Date.now() + 1000).toISOString()

  const matchedResponse = await listReviews(
    new Request(`http://localhost/api/reviews?assigneeRole=${encodeURIComponent('Ops Review')}&dueFrom=${encodeURIComponent(beforeDecision)}&dueTo=${encodeURIComponent(afterDecision)}&q=${encodeURIComponent('筛选后的审批项')}&pageSize=50`, { headers: authHeaders }),
  )
  const matchedEnvelope = await matchedResponse.json()
  assert.equal(matchedResponse.status, 200)
  assert.ok(matchedEnvelope.data.items.some((item: { reviewItemId: string; status: string }) => item.reviewItemId === reviewItemId && item.status === 'MODIFIED'))

  const missedResponse = await listReviews(
    new Request(`http://localhost/api/reviews?assigneeRole=${encodeURIComponent('Finance')}&dueFrom=${encodeURIComponent(beforeDecision)}&dueTo=${encodeURIComponent(afterDecision)}&q=${encodeURIComponent('筛选后的审批项')}&pageSize=50`, { headers: authHeaders }),
  )
  const missedEnvelope = await missedResponse.json()
  assert.equal(missedResponse.status, 200)
  assert.ok(!missedEnvelope.data.items.some((item: { reviewItemId: string }) => item.reviewItemId === reviewItemId))
})

test('review decision route accepts modified aliases as request changes', async () => {
  const [review] = await finalApiRuntime.reviewService.create([
    {
      sourceType: 'agent',
      sourceId: `review_route_modified_alias_${Date.now()}`,
      question: '是否要求修改后再批准？',
      recommendation: '需要修改建议后再继续。',
      riskLevel: 'L2',
      evidence: [],
    },
  ], boundary)

  const decisionResponse = await decideReview(
    new Request(`http://localhost/api/reviews/${review.reviewItemId}/decision`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ decision: 'CHANGES_REQUESTED', decisionBy: boundary.actorId, decisionComment: '路由别名测试：要求修改' }),
    }),
    { params: Promise.resolve({ reviewItemId: review.reviewItemId }) },
  )
  const decisionEnvelope = await decisionResponse.json()

  assert.equal(decisionResponse.status, 200)
  assert.equal(decisionEnvelope.code, 'OK')
  assert.equal(decisionEnvelope.data.status, 'MODIFIED')
  assert.equal(decisionEnvelope.data.approvalHistory.at(-1).action, 'review_decision')
  assert.equal(decisionEnvelope.data.approvalHistory.at(-1).comment, 'REQUEST_CHANGES')
})

test('review routes consistently return tenant boundary denial', async () => {
  const [review] = await finalApiRuntime.reviewService.create([
    {
      sourceType: 'agent',
      sourceId: `review_route_boundary_${Date.now()}`,
      question: '跨租户是否可见？',
      recommendation: '不应可见。',
      riskLevel: 'L1',
      evidence: [],
    },
  ], boundary)

  const responses = await Promise.all([
    getReview(new Request(`http://localhost/api/reviews/${review.reviewItemId}`, { headers: otherTenantHeaders }), { params: Promise.resolve({ reviewItemId: review.reviewItemId }) }),
    patchReview(new Request(`http://localhost/api/reviews/${review.reviewItemId}`, { method: 'PATCH', headers: otherTenantHeaders, body: JSON.stringify({ recommendation: '跨租户修改' }) }), { params: Promise.resolve({ reviewItemId: review.reviewItemId }) }),
    decideReview(new Request(`http://localhost/api/reviews/${review.reviewItemId}/decision`, { method: 'POST', headers: otherTenantHeaders, body: JSON.stringify({ decision: 'APPROVE', decisionBy: 'other' }) }), { params: Promise.resolve({ reviewItemId: review.reviewItemId }) }),
  ])

  for (const response of responses) {
    const envelope = await response.json()
    assert.equal(response.status, 403)
    assert.equal(envelope.code, 'P0.TENANT_BOUNDARY_DENIED')
  }
})
