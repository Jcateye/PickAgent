import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../_final-api-runtime'

import type { ReportRequestDto } from '../../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import { P0AuthBoundaryError } from '../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

export async function GET(request: Request) {
  try {
    return ok(await finalApiRuntime.reportService.list(authContextFromRequest(request)))
  } catch (error) {
    return authFail(error)
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as ReportRequestDto | null
  if (!payload?.type || !payload.skuProfileIds?.length) return fail('COMMON.VALIDATION_ERROR', 'type and skuProfileIds are required', 400)
  try {
    return ok(await finalApiRuntime.reportService.generate(payload, authContextFromRequest(request)))
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'Report generation failed', 400)
  }
}
