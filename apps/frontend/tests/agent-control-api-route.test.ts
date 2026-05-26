import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as getMission } from '../src/app/api/agent/missions/[missionId]/route'
import { POST as startRun } from '../src/app/api/agent/missions/[missionId]/runs/route'
import { POST as decideGate } from '../src/app/api/agent/review-gates/[gateId]/decision/route'
import { POST as cancelRun } from '../src/app/api/agent/runs/[runId]/cancel/route'
import { GET as getRunEvents } from '../src/app/api/agent/runs/[runId]/events/route'
import { POST as pauseRun } from '../src/app/api/agent/runs/[runId]/pause/route'
import { POST as answerQuestion } from '../src/app/api/agent/runs/[runId]/questions/route'
import { GET as getRun } from '../src/app/api/agent/runs/[runId]/route'

const jsonHeaders = { 'content-type': 'application/json' }

test('agent mission routes return stable not found codes for missing missions', async () => {
  const params = { params: Promise.resolve({ missionId: 'missing_mission' }) }

  const detailResponse = await getMission(new Request('http://localhost/api/agent/missions/missing_mission'), params)
  const detailEnvelope = await detailResponse.json()
  assert.equal(detailResponse.status, 404)
  assert.equal(detailEnvelope.code, 'AGENT_MISSION.NOT_FOUND')

  const startResponse = await startRun(
    new Request('http://localhost/api/agent/missions/missing_mission/runs', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ modelProvider: 'pi', modelName: 'sku-ready-agent' }),
    }),
    params,
  )
  const startEnvelope = await startResponse.json()
  assert.equal(startResponse.status, 404)
  assert.equal(startEnvelope.code, 'AGENT_MISSION.NOT_FOUND')
})

test('agent run routes return stable not found codes for missing runs', async () => {
  const params = { params: Promise.resolve({ runId: 'missing_run' }) }

  const detailResponse = await getRun(new Request('http://localhost/api/agent/runs/missing_run'), params)
  const detailEnvelope = await detailResponse.json()
  assert.equal(detailResponse.status, 404)
  assert.equal(detailEnvelope.code, 'AGENT_RUN.NOT_FOUND')

  const pauseResponse = await pauseRun(new Request('http://localhost/api/agent/runs/missing_run/pause', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) }), params)
  const pauseEnvelope = await pauseResponse.json()
  assert.equal(pauseResponse.status, 404)
  assert.equal(pauseEnvelope.code, 'AGENT_RUN.NOT_FOUND')

  const cancelResponse = await cancelRun(new Request('http://localhost/api/agent/runs/missing_run/cancel', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) }), params)
  const cancelEnvelope = await cancelResponse.json()
  assert.equal(cancelResponse.status, 404)
  assert.equal(cancelEnvelope.code, 'AGENT_RUN.NOT_FOUND')

  const questionResponse = await answerQuestion(
    new Request('http://localhost/api/agent/runs/missing_run/questions', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ question: '现在进度如何？' }),
    }),
    params,
  )
  const questionEnvelope = await questionResponse.json()
  assert.equal(questionResponse.status, 404)
  assert.equal(questionEnvelope.code, 'AGENT_RUN.NOT_FOUND')

  const eventsResponse = await getRunEvents(new Request('http://localhost/api/agent/runs/missing_run/events'), params)
  const eventsEnvelope = await eventsResponse.json()
  assert.equal(eventsResponse.status, 404)
  assert.equal(eventsEnvelope.code, 'AGENT_RUN.NOT_FOUND')
})

test('agent review gate route returns stable not found code for missing gate', async () => {
  const response = await decideGate(
    new Request('http://localhost/api/agent/review-gates/missing_gate/decision', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ decision: 'APPROVE', decidedBy: 'ops@example.test' }),
    }),
    { params: Promise.resolve({ gateId: 'missing_gate' }) },
  )
  const envelope = await response.json()

  assert.equal(response.status, 404)
  assert.equal(envelope.code, 'AGENT_REVIEW_GATE.NOT_FOUND')
})
