import { authContextFromRequest, authFail, fail, finalApiRuntime, ok } from '../../../_final-api-runtime'

import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import type { IngestPayloadDto, IngestRowDto } from '../../../../../../../contracts/types/businessFoundation'

export async function POST(request: Request) {
  try {
    const boundary = authContextFromRequest(request)
    const payload = await request.json().catch(() => null)
    if (!payload?.url || !Array.isArray(payload.rows)) return fail('COMMON.VALIDATION_ERROR', 'url and rows are required', 400)

    const preview = finalApiRuntime.browserConnectorService.scanPreview(payload)
    if (!preview.ingestReady) {
      return fail('COMMON.VALIDATION_ERROR', 'Browser scan is not ingest ready', 400, { warnings: preview.warnings, fieldMappings: preview.fieldMappings })
    }

    const ingestPayload = browserScanIngestPayload(payload, preview.detected.platform)
    const ingest = await finalApiRuntime.ingestService.ingest(ingestPayload, boundary)
    const run = payload.connectorId
      ? await finalApiRuntime.connectorService.createSyncRun(payload.connectorId, {
        rowCount: ingest.summaries.length,
        qualityScore: preview.qualityScore / 100,
        warnings: preview.warnings,
        summary: {
          source: 'browser_scan_ingest',
          url: payload.url,
          workflowRunId: ingest.workflowRunId,
          skuProfileIds: ingest.summaries.map((item) => item.skuProfileId),
        },
      }, boundary)
      : null

    return ok({ preview, ingest, run })
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    if (error instanceof Error) return fail('COMMON.VALIDATION_ERROR', error.message, 400)
    return authFail(error)
  }
}

function browserScanIngestPayload(input: Record<string, unknown>, detectedPlatform?: string): IngestPayloadDto {
  const platform = optionalString(input.platform) ?? detectedPlatform
  const storeId = optionalString(input.storeId)
  const rows = recordArray(input.rows).map((row, index) => browserScanIngestRow(row, index, platform, storeId, optionalString(input.url)))
  if (!rows.length) throw new Error('rows are required')
  return {
    connectorId: optionalString(input.connectorId),
    collectedAt: optionalString(input.collectedAt) ?? new Date().toISOString(),
    rows,
  }
}

function browserScanIngestRow(input: Record<string, unknown>, index: number, defaultPlatform?: string, defaultStoreId?: string, defaultUrl?: string): IngestRowDto {
  const platform = optionalString(input.platform) ?? defaultPlatform
  const storeId = optionalString(input.storeId) ?? defaultStoreId
  const externalSkuId = optionalString(input.externalSkuId ?? input.sku ?? input.skuId ?? input.itemId ?? input.productId)
  if (!platform || !storeId || !externalSkuId) throw new Error(`rows[${index}].platform, storeId, and externalSkuId are required`)
  return {
    platform,
    storeId,
    externalSkuId,
    productName: optionalString(input.productName ?? input.title ?? input.name),
    category: optionalString(input.category),
    brand: optionalString(input.brand),
    sourceUrl: optionalString(input.sourceUrl ?? input.url) ?? defaultUrl,
    rowIndex: Number.isInteger(input.rowIndex) ? Number(input.rowIndex) : index,
    sales30d: optionalNumber(input.sales30d ?? input.sales),
    positiveRate: optionalNumber(input.positiveRate ?? input.rating),
    stock: optionalNumber(input.stock ?? input.inventory),
    originalPrice: optionalNumber(input.originalPrice ?? input.price),
    lowestPrice30d: optionalNumber(input.lowestPrice30d),
    campaignPrice: optionalNumber(input.campaignPrice ?? input.promoPrice),
    joinedBrandDay: typeof input.joinedBrandDay === 'boolean' ? input.joinedBrandDay : undefined,
    certificateStatus: optionalString(input.certificateStatus),
    raw: input,
  }
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}
