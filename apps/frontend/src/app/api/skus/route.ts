import { authFail, fail, finalApiRuntime, ok, requireApiAuthContext } from '../_final-api-runtime'
import { parseSkuListQuery } from './sku-list-query'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestId = request.headers.get('x-request-id') ?? undefined
  try {
    const query = parseSkuListQuery(url.searchParams)
    if (!query) return fail('COMMON.VALIDATION_ERROR', 'SKU 列表查询参数不合法', 400, undefined, requestId)
    return ok(await finalApiRuntime.skuReadinessQueryService.list(query, requireApiAuthContext(request, requestId)), requestId)
  } catch (error) {
    return authFail(error)
  }
}
