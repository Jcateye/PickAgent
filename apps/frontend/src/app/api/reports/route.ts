import { fail, finalApiRuntime, ok } from '../_final-api-runtime'

import type { ReportRequestDto } from '../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ReportRequestDto | null
  if (!payload?.type || !payload.skuProfileIds?.length) return fail('COMMON.VALIDATION_ERROR', 'type and skuProfileIds are required', 400)
  return ok(await finalApiRuntime.reportService.generate(payload))
}
