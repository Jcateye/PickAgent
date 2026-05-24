import type { DashboardSkuListQuery } from '../../../../../contracts/types/dashboardSkuReadModels'
import { fail, finalApiRuntime, ok, parsePositiveInt, requireApiAuthContext } from '../_final-api-runtime'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestId = request.headers.get('x-request-id') ?? undefined
  const query = parseSkuListQuery(url.searchParams)
  if (!query) return fail('COMMON.VALIDATION_ERROR', 'SKU 列表查询参数不合法', 400, undefined, requestId)
  return ok(await finalApiRuntime.skuReadinessQueryService.list(query, requireApiAuthContext(request, requestId)), requestId)
}

function parseSkuListQuery(params: URLSearchParams): DashboardSkuListQuery | null {
  const healthStatus = optionalEnum(params.get('healthStatus'), ['READY', 'REPAIRABLE', 'RISKY', 'BLOCKED'] as const)
  const eligibilityStatus = optionalEnum(params.get('eligibilityStatus'), ['DIRECT_READY', 'REPAIRABLE_READY', 'MANUAL_REVIEW', 'BLOCKED'] as const)
  const sortBy = optionalEnum(params.get('sortBy'), ['sales30d', 'positiveRate', 'stock', 'updatedAt'] as const)
  const sortOrder = optionalEnum(params.get('sortOrder'), ['asc', 'desc'] as const)
  if (healthStatus === null || eligibilityStatus === null || sortBy === null || sortOrder === null) return null
  return {
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: parsePositiveInt(params.get('pageSize'), 20),
    q: params.get('q') ?? undefined,
    platform: params.get('platform') ?? undefined,
    category: params.get('category') ?? undefined,
    healthStatus,
    eligibilityStatus,
    certificateStatus: params.get('certificateStatus') ?? undefined,
    activityId: params.get('activityId') ?? undefined,
    sortBy,
    sortOrder,
  }
}

function optionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined | null {
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}
