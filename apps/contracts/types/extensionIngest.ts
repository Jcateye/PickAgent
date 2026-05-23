export type ExtensionIngestSchemaVersion = "extension-ingest.v1"

export interface ExtensionIngestRow {
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

export interface ExtensionIngestPayload {
  readonly schemaVersion: ExtensionIngestSchemaVersion
  readonly runId: string
  readonly platform: string
  readonly sourceKind?: "product"
  readonly sourceUrl: string
  readonly collectedAt: string
  readonly rows: readonly ExtensionIngestRow[]
}

export type ExtensionCommentIngestSchemaVersion = "extension-comment-ingest.v1"

export interface ExtensionCommentIngestRow {
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

export interface ExtensionCommentStatistics {
  readonly commentCount: number
  readonly lowRatingCount: number
  readonly negativeCommentCount: number
  readonly unrepliedCommentCount: number
  readonly latestCommentAt: string | null
  readonly commentDataCollectedAt: string
}

export interface ExtensionCommentIngestPayload {
  readonly schemaVersion: ExtensionCommentIngestSchemaVersion
  readonly runId: string
  readonly platform: string
  readonly sourceKind: "comment"
  readonly sourceUrl: string
  readonly collectedAt: string
  readonly rows: readonly ExtensionCommentIngestRow[]
  readonly statistics: ExtensionCommentStatistics
}

export interface ExtensionIngestDependencyNote {
  readonly dependsOnChange: "backend-business-foundation"
  readonly capability: "ingest-and-current-projection"
  readonly status: "required-before-real-api-submit"
}
