export type CollectablePageStatus = "collectible" | "unsupported" | "needs-confirmation"

export type RunStatus = "idle" | "scanned" | "collecting" | "paused" | "submitted" | "failed"

export type StandardFieldKey =
  | "externalSkuId"
  | "title"
  | "salePrice"
  | "availableStock"
  | "category"
  | "listingStatus"

export interface PageRecognitionResult {
  readonly status: CollectablePageStatus
  readonly confidence: number
  readonly platform: string
  readonly pageType: string
  readonly pageIndex: number
  readonly totalPages: number
  readonly reasons: readonly string[]
  readonly unsupportedReason?: string
}

export interface RawProductRow {
  readonly rowIndex: number
  readonly source: Record<string, string | number | null>
}

export interface StandardProductRow {
  readonly rowIndex: number
  readonly externalSkuId: string
  readonly title: string
  readonly salePrice: number | null
  readonly availableStock: number | null
  readonly category: string | null
  readonly listingStatus: string | null
  readonly sourceUrl: string
  readonly raw: Record<string, string | number | null>
  readonly warnings: readonly string[]
}

export interface FieldMappingPreview {
  readonly sourceLabel: string
  readonly targetKey: StandardFieldKey
  readonly targetLabel: string
  readonly status: "mapped" | "missing"
  readonly sampleValue: string
}

export interface PageExtractionPreview {
  readonly pageIndex: number
  readonly sourceUrl: string
  readonly rows: readonly StandardProductRow[]
  readonly mapping: readonly FieldMappingPreview[]
  readonly warnings: readonly string[]
}

export interface IngestCollectionPayload {
  readonly schemaVersion: "extension-ingest.v1"
  readonly runId: string
  readonly platform: string
  readonly sourceUrl: string
  readonly collectedAt: string
  readonly rows: readonly StandardProductRow[]
}

export interface CollectionRunState {
  readonly runId: string
  readonly status: RunStatus
  readonly currentPage: number
  readonly totalPages: number
  readonly collectedRows: readonly StandardProductRow[]
  readonly currentPreview?: PageExtractionPreview
  readonly interruptionReason?: string
  readonly submitReceipt?: MockSubmitReceipt
}

export interface MockSubmitReceipt {
  readonly ok: boolean
  readonly submitId: string
  readonly acceptedRows: number
  readonly adapter: "mock"
  readonly message: string
}
