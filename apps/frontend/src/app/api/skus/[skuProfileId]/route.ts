import { fail, finalApiRuntime, ok } from '../../_final-api-runtime'

interface RouteContext {
  params: Promise<{ skuProfileId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { skuProfileId } = await context.params
  const detail = finalApiRuntime.ingestService.getSkuDetail(skuProfileId)
  if (!detail) return fail('SKU.NOT_FOUND', 'SKU 不存在', 404, { skuProfileId })
  return ok(detail)
}
