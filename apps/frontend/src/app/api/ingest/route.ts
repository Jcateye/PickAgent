import { fail, finalApiRuntime, ok } from '../_final-api-runtime'

import type { IngestPayloadDto } from '../../../../../contracts/types/businessFoundation'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as IngestPayloadDto | null
  if (!payload) return fail('COMMON.VALIDATION_ERROR', 'Invalid JSON payload', 400)
  try {
    return ok(await finalApiRuntime.ingestService.ingest(payload))
  } catch (error) {
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Invalid ingest payload', 400)
  }
}
