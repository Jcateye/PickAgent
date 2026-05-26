import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchActivityApi } from '../src/modules/activity/api-client'

test('fetchActivityApi surfaces backend envelope errors', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: 'RULE.NOT_FOUND',
    message: '规则集不存在',
    data: null,
    requestId: 'request_test',
  }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch

  try {
    await assert.rejects(fetchActivityApi('/api/rule-sets/missing'), /规则集不存在/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('fetchActivityApi turns non-json failures into actionable page errors', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('<html>upstream unavailable</html>', {
    status: 502,
    headers: { 'content-type': 'text/html' },
  })) as unknown as typeof fetch

  try {
    await assert.rejects(fetchActivityApi('/api/reports'), /upstream unavailable/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('fetchActivityApi rejects invalid json without leaking parser syntax', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('{not valid json', {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch

  try {
    await assert.rejects(fetchActivityApi('/api/skus'), /API returned invalid JSON/)
  } finally {
    globalThis.fetch = previousFetch
  }
})
