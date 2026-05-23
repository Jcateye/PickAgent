import {
  mockConnectorConsole,
  mockDashboardSummary,
  mockSkuDetails,
} from '@/modules/staff-health-console/mock-fixtures'

export function getDashboardSummary() {
  return mockDashboardSummary
}

export function getConnectorConsole() {
  return mockConnectorConsole
}

export function getSkuList() {
  return mockSkuDetails.map((detail) => detail.projection)
}

export function getSkuDetail(skuProfileId?: string) {
  return mockSkuDetails.find((detail) => detail.projection.skuProfileId === skuProfileId) ?? mockSkuDetails[0]
}

export const realQueryIntegrationDependency =
  '真实 summary / connector / sku / workflow 查询接口依赖 backend-business-foundation 的 projection / query 能力完成；Layer 1 使用同一 DTO contract 的 mock adapter，不实现 SkuQueryService。'
