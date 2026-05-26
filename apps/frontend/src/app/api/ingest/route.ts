import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { IngestPayloadDto } from '../../../../../contracts/types/businessFoundation'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as IngestPayloadDto | null
  if (!payload) return fail('COMMON.VALIDATION_ERROR', 'Invalid JSON payload', 400)
  try {
    return ok(await finalApiRuntime.ingestService.ingest(payload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Invalid ingest payload', 400)
  }
}
