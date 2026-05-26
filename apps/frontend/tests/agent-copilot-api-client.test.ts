import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchAgentApi } from '../src/modules/agent-copilot/api-client'

test('fetchAgentApi surfaces backend envelope errors', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ code: 'AGENT.FAILED', message: 'agent tool failed', data: null }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch

  try {
    await assert.rejects(fetchAgentApi('/api/agent/chat'), /agent tool failed/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('fetchAgentApi turns non-json failures into actionable errors', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('<html>dev server error</html>', {
    status: 500,
    headers: { 'content-type': 'text/html' },
  })) as unknown as typeof fetch

  try {
    await assert.rejects(fetchAgentApi('/api/agent/chat'), /dev server error/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('fetchAgentApi rejects invalid json without leaking parser syntax', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{broken', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch

  try {
    await assert.rejects(fetchAgentApi('/api/agent/chat'), /Agent API returned invalid JSON/)
  } finally {
    globalThis.fetch = previousFetch
  }
})
