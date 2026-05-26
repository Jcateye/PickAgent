'use client'

export interface ApiEnvelope<T> {
  code: string
  message: string
  data: T | null
  requestId: string
}

export interface PageDto<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface HealthSummaryDto {
  total: number
  ready: number
  warning: number
  blocked: number
}

export async function fetchActivityApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-p0-actor-id': 'frontend_console',
      'x-p0-tenant-id': 'dev_tenant',
      'x-p0-session-id': 'frontend_session',
      'x-p0-surface': 'frontend-console',
      ...(init?.headers ?? {}),
    },
  })
  const envelope = await readApiEnvelope<T>(response, path)
  if (!response.ok || envelope.code !== 'OK' || envelope.data === null) {
    throw new Error(envelope.message || `API request failed: ${path}`)
  }
  return envelope.data
}

async function readApiEnvelope<T>(response: Response, path: string): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get('content-type') ?? ''
  const body = await response.text()
  if (!body.trim()) {
    return {
      code: response.ok ? 'OK' : `HTTP.${response.status}`,
      message: response.ok ? '' : `API request failed: ${path} (${response.status})`,
      data: null,
      requestId: response.headers.get('x-request-id') ?? '',
    }
  }
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(body) as ApiEnvelope<T>
    } catch {
      return {
        code: `HTTP.${response.status}`,
        message: `API returned invalid JSON: ${path}`,
        data: null,
        requestId: response.headers.get('x-request-id') ?? '',
      }
    }
  }
  return {
    code: `HTTP.${response.status}`,
    message: response.ok ? `API returned non-JSON response: ${path}` : body.slice(0, 240) || `API request failed: ${path} (${response.status})`,
    data: null,
    requestId: response.headers.get('x-request-id') ?? '',
  }
}
