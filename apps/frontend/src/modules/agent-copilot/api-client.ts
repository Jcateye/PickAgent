'use client'

export interface AgentApiEnvelope<T> {
  code: string
  message?: string
  data?: T | null
  requestId?: string
}

export async function fetchAgentApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const envelope = await readAgentApiEnvelope<T>(response, path)
  if (!response.ok || envelope.code !== 'OK' || envelope.data == null) {
    throw new Error(envelope.message || `Agent API request failed: ${path}`)
  }
  return envelope.data
}

async function readAgentApiEnvelope<T>(response: Response, path: string): Promise<AgentApiEnvelope<T>> {
  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()
  if (!body.trim()) {
    return {
      code: response.ok ? 'OK' : `HTTP.${response.status}`,
      message: response.ok ? '' : `Agent API request failed: ${path} (${response.status})`,
      data: null,
      requestId: response.headers.get('x-request-id') ?? undefined,
    }
  }
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(body) as AgentApiEnvelope<T>
    } catch {
      return {
        code: `HTTP.${response.status}`,
        message: `Agent API returned invalid JSON: ${path}`,
        data: null,
        requestId: response.headers.get('x-request-id') ?? undefined,
      }
    }
  }
  return {
    code: `HTTP.${response.status}`,
    message: response.ok ? `Agent API returned non-JSON response: ${path}` : body.slice(0, 240) || `Agent API request failed: ${path} (${response.status})`,
    data: null,
    requestId: response.headers.get('x-request-id') ?? undefined,
  }
}
