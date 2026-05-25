import assert from 'node:assert/strict'
import test from 'node:test'

import { GET as getToolPolicy, PATCH as updateToolPolicy } from '../src/app/api/settings/tool-policy/route'
import { GET as getWorkspace, PATCH as updateWorkspace } from '../src/app/api/settings/workspace/route'

const authHeaders = {
  'content-type': 'application/json',
  'x-p0-actor-id': 'settings_route_tester',
  'x-p0-tenant-id': 'dev_tenant',
  'x-p0-session-id': 'settings_route_session',
  'x-p0-surface': 'route-test',
  'x-request-id': 'settings_route_request',
}

test('settings routes preserve tool policy across workspace and partial policy updates', async () => {
  const policyResponse = await updateToolPolicy(
    new Request('http://localhost/api/settings/tool-policy', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ allowedAgentTools: ['getSkuSummary', 'ingestSkus'], deniedRuntimeTools: ['customDeniedForRoute'] }),
    }),
  )
  const policyEnvelope = await policyResponse.json()
  assert.equal(policyResponse.status, 200)
  assert.deepEqual(policyEnvelope.data.allowedAgentTools, ['getSkuSummary', 'ingestSkus'])

  const workspaceResponse = await updateWorkspace(
    new Request('http://localhost/api/settings/workspace', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ dataFreshnessThresholdHours: 9 }),
    }),
  )
  const workspaceEnvelope = await workspaceResponse.json()
  assert.equal(workspaceResponse.status, 200)
  assert.equal(workspaceEnvelope.data.dataFreshnessThresholdHours, 9)

  const policyAfterWorkspaceResponse = await getToolPolicy(new Request('http://localhost/api/settings/tool-policy', { headers: authHeaders }))
  const policyAfterWorkspaceEnvelope = await policyAfterWorkspaceResponse.json()
  assert.equal(policyAfterWorkspaceResponse.status, 200)
  assert.deepEqual(policyAfterWorkspaceEnvelope.data.allowedAgentTools, ['getSkuSummary', 'ingestSkus'])
  assert.ok(policyAfterWorkspaceEnvelope.data.deniedRuntimeTools.includes('customDeniedForRoute'))

  const partialPolicyResponse = await updateToolPolicy(
    new Request('http://localhost/api/settings/tool-policy', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ deniedRuntimeTools: ['customDeniedForRoute', 'secondDeniedForRoute'] }),
    }),
  )
  const partialPolicyEnvelope = await partialPolicyResponse.json()
  assert.equal(partialPolicyResponse.status, 200)
  assert.deepEqual(partialPolicyEnvelope.data.allowedAgentTools, ['getSkuSummary', 'ingestSkus'])
  assert.ok(partialPolicyEnvelope.data.deniedRuntimeTools.includes('secondDeniedForRoute'))

  const finalWorkspaceResponse = await getWorkspace(new Request('http://localhost/api/settings/workspace', { headers: authHeaders }))
  const finalWorkspaceEnvelope = await finalWorkspaceResponse.json()
  assert.equal(finalWorkspaceResponse.status, 200)
  assert.deepEqual(finalWorkspaceEnvelope.data.allowedAgentTools, ['getSkuSummary', 'ingestSkus'])
})
