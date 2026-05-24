import { fail, finalApiRuntime, ok, requireApiAuthContext } from '../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ skuProfileId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { skuProfileId } = await context.params
  const requestId = request.headers.get('x-request-id') ?? undefined
  const detail = await finalApiRuntime.skuReadinessQueryService.detail(skuProfileId, requireApiAuthContext(request, requestId))
  if (!detail) return fail('SKU.NOT_FOUND', 'SKU 不存在', 404, { skuProfileId }, requestId)
  return ok(detail, requestId)
}
