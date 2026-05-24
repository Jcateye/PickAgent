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
      'x-p0-tenant-id': 'demo_tenant',
      'x-p0-session-id': 'frontend_session',
      'x-p0-surface': 'frontend-console',
      ...(init?.headers ?? {}),
    },
  })
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || envelope.code !== 'OK' || envelope.data === null) {
    throw new Error(envelope.message || `API request failed: ${path}`)
  }
  return envelope.data
}
