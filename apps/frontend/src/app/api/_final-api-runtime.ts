import { NextResponse } from 'next/server'

import type { ApiEnvelope } from '../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import { createFinalApiPersistenceRuntime } from '../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

type FinalApiRuntime = ReturnType<typeof createFinalApiPersistenceRuntime>

declare global {
  // eslint-disable-next-line no-var
  var pickAgentFinalApiRuntime: FinalApiRuntime | undefined
}

export const dynamic = 'force-dynamic'
export const finalApiRuntime = globalThis.pickAgentFinalApiRuntime ?? createFinalApiPersistenceRuntime()
globalThis.pickAgentFinalApiRuntime = finalApiRuntime

export function ok<T>(data: T, requestId = nextRequestId()): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({ code: 'OK', message: 'success', data, requestId })
}

export function fail(code: ApiEnvelope<never>['code'], message: string, status: number, details?: Record<string, unknown>, requestId = nextRequestId()): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json({ code, message, data: null, requestId, details }, { status })
}

export function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function nextRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
