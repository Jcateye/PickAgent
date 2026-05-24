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
  const healthStatuses = optionalEnumList(params.get('healthStatuses'), ['READY', 'REPAIRABLE', 'RISKY', 'BLOCKED'] as const)
  const eligibilityStatuses = optionalEnumList(params.get('eligibilityStatuses'), ['DIRECT_READY', 'REPAIRABLE_READY', 'MANUAL_REVIEW', 'BLOCKED'] as const)
  const sortBy = optionalEnum(params.get('sortBy'), ['sales30d', 'positiveRate', 'stock', 'qualityScore', 'collectedAt', 'updatedAt'] as const)
  const sortOrder = optionalEnum(params.get('sortOrder'), ['asc', 'desc'] as const)
  if (healthStatus === null || eligibilityStatus === null || healthStatuses === null || eligibilityStatuses === null || sortBy === null || sortOrder === null) return null
  return {
    page: parsePositiveInt(params.get('page'), 1),
    pageSize: parsePositiveInt(params.get('pageSize'), 20),
    q: params.get('q') ?? undefined,
    skuProfileId: params.get('skuProfileId') ?? undefined,
    externalSkuId: params.get('externalSkuId') ?? undefined,
    productName: params.get('productName') ?? undefined,
    storeId: params.get('storeId') ?? undefined,
    platform: params.get('platform') ?? undefined,
    platforms: optionalStringList(params.get('platforms')),
    category: params.get('category') ?? undefined,
    categories: optionalStringList(params.get('categories')),
    healthStatus,
    healthStatuses,
    eligibilityStatus,
    eligibilityStatuses,
    certificateStatus: params.get('certificateStatus') ?? undefined,
    certificateStatuses: optionalStringList(params.get('certificateStatuses')),
    qualityLabel: params.get('qualityLabel') ?? undefined,
    qualityLabels: optionalStringList(params.get('qualityLabels')),
    sourceKind: params.get('sourceKind') ?? undefined,
    sourceKinds: optionalStringList(params.get('sourceKinds')),
    minSales30d: optionalNumber(params.get('minSales30d')),
    maxSales30d: optionalNumber(params.get('maxSales30d')),
    minPositiveRate: optionalNumber(params.get('minPositiveRate')),
    maxPositiveRate: optionalNumber(params.get('maxPositiveRate')),
    minStock: optionalNumber(params.get('minStock')),
    maxStock: optionalNumber(params.get('maxStock')),
    minQualityScore: optionalNumber(params.get('minQualityScore')),
    maxQualityScore: optionalNumber(params.get('maxQualityScore')),
    collectedAtFrom: optionalIsoDate(params.get('collectedAtFrom')),
    collectedAtTo: optionalIsoDate(params.get('collectedAtTo')),
    updatedAtFrom: optionalIsoDate(params.get('updatedAtFrom')),
    updatedAtTo: optionalIsoDate(params.get('updatedAtTo')),
    activityId: params.get('activityId') ?? undefined,
    sortBy,
    sortOrder,
  }
}

function optionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined | null {
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

function optionalEnumList<T extends string>(value: string | null, allowed: readonly T[]): T[] | undefined | null {
  const items = optionalStringList(value)
  if (!items) return undefined
  const invalid = items.some((item) => !(allowed as readonly string[]).includes(item))
  return invalid ? null : (items as T[])
}

function optionalStringList(value: string | null): string[] | undefined {
  if (!value) return undefined
  const items = value.split(',').map((item) => item.trim()).filter(Boolean)
  return items.length > 0 ? items : undefined
}

function optionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function optionalIsoDate(value: string | null): string | undefined {
  if (!value) return undefined
  return Number.isNaN(Date.parse(value)) ? undefined : value
}
