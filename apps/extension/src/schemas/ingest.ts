export type CollectablePageStatus = "collectible" | "unsupported" | "needs-confirmation"

export type LegacyRunStatus = "idle" | "scanned" | "collecting" | "paused" | "submitted" | "failed"

export type RunStatus =
  | "idle"
  | "recognizing"
  | "ready"
  | "collecting_products"
  | "collecting_comments"
  | "pausing"
  | "paused"
  | "submitting"
  | "submitted"
  | "failed"
  | "resetting"

export type CollectionTaskEvent =
  | "START"
  | "PAGE_RECOGNIZED"
  | "PAGE_UNSUPPORTED"
  | "PAGE_COLLECTED"
  | "NEXT_PAGE"
  | "RATE_LIMITED"
  | "STRUCTURE_CHANGED"
  | "PAUSE"
  | "RESUME"
  | "RESET"
  | "SUBMIT"
  | "FAIL"

export type SourceKind = "product" | "comment"

export type DoudianPageType = "product-list" | "comment-list" | "unsupported"

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
  readonly sourceKind?: SourceKind
  readonly pageIndex: number
  readonly totalPages: number
  readonly reasons: readonly string[]
  readonly unsupportedReason?: string
}

export interface RawProductRow {
  readonly rowIndex: number
  readonly source: Record<string, unknown>
}

export interface StandardProductRow {
  readonly sourceKind?: "product"
  readonly rowIndex: number
  readonly externalProductId?: string | null
  readonly externalSkuId: string
  readonly title: string
  readonly salePrice: number | null
  readonly availableStock: number | null
  readonly category: string | null
  readonly listingStatus: string | null
  readonly activityLabels?: readonly string[]
  readonly updatedAt?: string | null
  readonly sourceUrl: string
  readonly raw: Record<string, unknown>
  readonly warnings: readonly string[]
}

export interface StandardCommentRow {
  readonly sourceKind: "comment"
  readonly rowIndex: number
  readonly externalCommentId: string
  readonly externalProductId: string | null
  readonly externalSkuId: string | null
  readonly rating: number | null
  readonly contentText: string | null
  readonly commentedAt: string | null
  readonly imageCount: number
  readonly videoCount: number
  readonly isAfterSale: boolean
  readonly isFollowUp: boolean
  readonly isNegative: boolean
  readonly replyStatus: string | null
  readonly sourceUrl: string
  readonly raw: Record<string, unknown>
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

export type CommentFieldKey =
  | "externalCommentId"
  | "externalProductId"
  | "externalSkuId"
  | "rating"
  | "contentText"
  | "commentedAt"
  | "replyStatus"

export interface CommentFieldMappingPreview {
  readonly sourceLabel: string
  readonly targetKey: CommentFieldKey
  readonly targetLabel: string
  readonly status: "mapped" | "missing"
  readonly sampleValue: string
}

export interface CommentExtractionPreview {
  readonly pageIndex: number
  readonly sourceUrl: string
  readonly rows: readonly StandardCommentRow[]
  readonly mapping: readonly CommentFieldMappingPreview[]
  readonly warnings: readonly string[]
}

export interface IngestCollectionPayload {
  readonly schemaVersion: "extension-ingest.v1"
  readonly runId: string
  readonly platform: string
  readonly sourceKind?: "product"
  readonly sourceUrl: string
  readonly collectedAt: string
  readonly rows: readonly StandardProductRow[]
}

export interface CommentIngestCollectionPayload {
  readonly schemaVersion: "extension-comment-ingest.v1"
  readonly runId: string
  readonly platform: string
  readonly sourceKind: "comment"
  readonly sourceUrl: string
  readonly collectedAt: string
  readonly rows: readonly StandardCommentRow[]
  readonly statistics: CommentStatistics
}

export interface CommentStatistics {
  readonly commentCount: number
  readonly lowRatingCount: number
  readonly negativeCommentCount: number
  readonly unrepliedCommentCount: number
  readonly latestCommentAt: string | null
  readonly commentDataCollectedAt: string
}

export interface CollectionStatistics extends CommentStatistics {
  readonly productCount: number
  readonly skuCount: number
  readonly warningRowCount: number
  readonly collectedPageCount: number
  readonly failedPageCount: number
}

export interface CollectionCheckpoint {
  readonly pageType: DoudianPageType
  readonly nextPageIndex: number
  readonly totalPages: number
  readonly productRowCount: number
  readonly commentRowCount: number
  readonly updatedAt: string
}

export interface CollectionTaskState {
  readonly runId: string
  readonly status: RunStatus
  readonly activePageType: DoudianPageType
  readonly currentPage: number
  readonly totalPages: number
  readonly collectedProductRows: readonly StandardProductRow[]
  readonly collectedCommentRows: readonly StandardCommentRow[]
  readonly currentProductPreview?: PageExtractionPreview
  readonly currentCommentPreview?: CommentExtractionPreview
  readonly lastRecognition?: PageRecognitionResult
  readonly lastEvent?: CollectionTaskEvent
  readonly lastError?: string
  readonly checkpoint?: CollectionCheckpoint
  readonly submitted: boolean
  readonly submitReceipt?: SubmitReceipt
  readonly statistics: CollectionStatistics
}

export interface CollectionRunState {
  readonly runId: string
  readonly status: LegacyRunStatus
  readonly currentPage: number
  readonly totalPages: number
  readonly collectedRows: readonly StandardProductRow[]
  readonly currentPreview?: PageExtractionPreview
  readonly interruptionReason?: string
  readonly submitReceipt?: SubmitReceipt
}

export interface SubmitReceipt {
  readonly ok: boolean
  readonly submitId: string
  readonly acceptedRows: number
  readonly adapter: "mock" | "real-api"
  readonly message: string
}

export type MockSubmitReceipt = SubmitReceipt & {
  readonly adapter: "mock"
}
