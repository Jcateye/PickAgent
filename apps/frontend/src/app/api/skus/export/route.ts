import { P0AuthBoundaryError } from '../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import { fail, finalApiRuntime, ok, requireApiAuthContext } from '../../_final-api-runtime'
import { parseSkuListQuery } from '../sku-list-query'

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? undefined
  try {
    const payload = await request.json().catch(() => ({})) as { query?: Record<string, unknown> }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(payload.query ?? {})) {
      if (value === undefined || value === null || value === '' || value === 'ALL') continue
      params.set(key, Array.isArray(value) ? value.join(',') : String(value))
    }
    const query = parseSkuListQuery(params)
    if (!query) return fail('COMMON.VALIDATION_ERROR', 'SKU 导出查询参数不合法', 400, undefined, requestId)
    const boundary = requireApiAuthContext(request, requestId)
    return ok(await finalApiRuntime.skuReadinessQueryService.exportList(query, boundary), requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return fail('P0.TENANT_BOUNDARY_DENIED', error.message, 403, error.audit, requestId)
    return fail('COMMON.VALIDATION_ERROR', error instanceof Error ? error.message : 'SKU export failed', 400, undefined, requestId)
  }
}
