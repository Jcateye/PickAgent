export type ExtensionIngestSchemaVersion = "extension-ingest.v1"

export interface ExtensionIngestRow {
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

export interface ExtensionIngestPayload {
  readonly schemaVersion: ExtensionIngestSchemaVersion
  readonly runId: string
  readonly platform: string
  readonly sourceUrl: string
  readonly collectedAt: string
  readonly rows: readonly ExtensionIngestRow[]
}

export interface ExtensionIngestDependencyNote {
  readonly dependsOnChange: "backend-business-foundation"
  readonly capability: "ingest-and-current-projection"
  readonly status: "required-before-real-api-submit"
}
