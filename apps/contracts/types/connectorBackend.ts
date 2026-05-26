export interface ApiEnvelope<T> {
  code: "OK" | string;
  message: string;
  data: T | null;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type ConnectorKind = "browser_extension" | "platform_api" | "report_import" | string;
export type ConnectorStatus = "ACTIVE" | "INACTIVE" | "NEEDS_AUTH" | "FAILED" | "DISABLED";
export type ConnectorRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface TraceableRef {
  entityType:
    | "connector"
    | "connector_run"
    | "workflow_run"
    | "workflow_step"
    | "sku_snapshot"
    | "sku_profile"
    | "agent_tool_call";
  entityId: string;
  label: string;
  href?: string;
  drawerTarget?: string;
}

export interface ConnectorListItemDto {
  connectorId: string;
  code: string;
  name: string;
  kind: ConnectorKind;
  platform?: string;
  status: ConnectorStatus;
  permissionSummary: string;
  configSummary: string;
  latestRun?: ConnectorRunSummaryDto;
  traceRef: TraceableRef;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorDetailDto extends ConnectorListItemDto {
  config: Record<string, unknown>;
  permissions: Array<{ key: string; label: string; granted: boolean }>;
  recentRuns: ConnectorRunSummaryDto[];
  workflowRunId?: string;
}

export interface ConnectorRunSummaryDto {
  connectorRunId: string;
  connectorId: string;
  status: ConnectorRunStatus;
  rowCount: number;
  qualityScore?: number;
  warnings: string[];
  startedAt?: string;
  completedAt?: string;
  workflowRunRef?: TraceableRef;
  traceRef: TraceableRef;
}

export interface ConnectorRunDetailDto extends ConnectorRunSummaryDto {
  summary: Record<string, unknown>;
  connectorRef: TraceableRef;
}

export interface CreateConnectorDto {
  code: string;
  name: string;
  kind: ConnectorKind;
  platform?: string;
  config?: Record<string, unknown>;
  status?: ConnectorStatus;
}

export interface UpdateConnectorDto {
  name?: string;
  platform?: string | null;
  config?: Record<string, unknown>;
  status?: ConnectorStatus;
}

export interface CreateConnectorSyncRunDto {
  rowCount?: number;
  qualityScore?: number;
  warnings?: string[];
  summary?: Record<string, unknown>;
}

export interface BrowserPageDetectionRequestDto {
  url: string;
  title?: string;
  htmlTextSample?: string;
}

export interface BrowserPageDetectionDto {
  supported: boolean;
  pageType: "SKU_LIST" | "SKU_DETAIL" | "ORDER_LIST" | "UNKNOWN";
  platform?: string;
  confidence: number;
  reason: string;
  traceRef: TraceableRef;
}

export interface BrowserScanPreviewRequestDto {
  connectorId?: string;
  url: string;
  collectedAt?: string;
  rows: Array<Record<string, unknown>>;
}

export interface BrowserScanPreviewDto {
  connectorId?: string;
  detected: BrowserPageDetectionDto;
  rowCount: number;
  qualityScore: number;
  warnings: string[];
  fieldMappings: Array<{ sourceField: string; targetField: string; confidence: number }>;
  sampleRows: Array<Record<string, unknown>>;
  ingestReady: boolean;
  traceRefs: TraceableRef[];
}
