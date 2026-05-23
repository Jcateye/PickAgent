import type { IngestCollectionPayload, StandardProductRow } from "../../schemas/ingest"

export interface FoundationIngestRowDto {
  readonly platform: string
  readonly storeId: string
  readonly externalSkuId: string
  readonly productName?: string
  readonly category?: string
  readonly brand?: string
  readonly sourceUrl?: string
  readonly rowIndex?: number
  readonly sales30d?: number
  readonly positiveRate?: number
  readonly stock?: number
  readonly originalPrice?: number
  readonly lowestPrice30d?: number
  readonly campaignPrice?: number
  readonly joinedBrandDay?: boolean
  readonly certificateStatus?: string
  readonly raw: Record<string, unknown>
}

export interface FoundationIngestPayloadDto {
  readonly connectorId?: string
  readonly collectedAt: string
  readonly rows: readonly FoundationIngestRowDto[]
}

export interface FoundationIngestTransformOptions {
  readonly connectorId?: string
  readonly storeId?: string
}

export function toFoundationIngestPayload(
  payload: IngestCollectionPayload,
  options: FoundationIngestTransformOptions = {}
): FoundationIngestPayloadDto {
  return {
    connectorId: options.connectorId ?? "doudian-browser-extension",
    collectedAt: payload.collectedAt,
    rows: payload.rows.map((row) => toFoundationIngestRow(payload, row, options))
  }
}

function toFoundationIngestRow(
  payload: IngestCollectionPayload,
  row: StandardProductRow,
  options: FoundationIngestTransformOptions
): FoundationIngestRowDto {
  return {
    platform: "doudian",
    storeId: options.storeId ?? inferStoreId(payload.sourceUrl),
    externalSkuId: row.externalSkuId,
    productName: row.title,
    category: row.category ?? undefined,
    sourceUrl: row.sourceUrl,
    rowIndex: row.rowIndex,
    stock: row.availableStock ?? undefined,
    campaignPrice: row.salePrice ?? undefined,
    raw: {
      ...row.raw,
      extensionWarnings: row.warnings,
      extensionSourceKind: row.sourceKind ?? payload.sourceKind ?? "product",
      extensionRunId: payload.runId,
      externalProductId: row.externalProductId ?? null,
      listingStatus: row.listingStatus,
      activityLabels: row.activityLabels ?? [],
      updatedAt: row.updatedAt ?? null
    }
  }
}

function inferStoreId(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl)
    return url.hostname || "doudian-current-shop"
  } catch {
    return "doudian-current-shop"
  }
}
