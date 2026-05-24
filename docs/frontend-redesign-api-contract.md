# Frontend Redesign API Contract

日期：2026-05-24

来源原型：

- `/Users/haoqi/Downloads/原图原型pickagent_副本2`
- `/Users/haoqi/Downloads/原图原型pickagent_副本2/pickagent2`

## 1. 页面口径

新版一级菜单以 `pickagent2/` 深色侧栏为准：

1. 概览
2. SKU列表
3. 活动管理
4. 任务与运行
5. Review工作台
6. 报告中心
7. 数据源
8. 规则库
9. 设置

旧版原型里的 `执行中心`、`运行控制台`、`插件侧边栏` 不作为新版一级菜单，但其中的页面能力并入：

- `执行中心 / SKU准入工作台` -> `SKU列表`
- `执行中心 / 规则执行路径` -> `活动管理`
- `执行中心 / Run详情` -> `任务与运行`
- `审核中心 / Review工作台` -> `Review工作台`
- `插件中心 / 浏览器插件侧边栏` -> `数据源`

## 2. 通用响应与基础类型

所有 HTTP API 返回统一 envelope：

```ts
interface ApiEnvelope<T> {
  code: "OK" | string;
  message: string;
  data: T | null;
  requestId: string;
  details?: Record<string, unknown>;
}

interface PageDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

前端所有 evidence、规则、run、review、tool trace 的点击跳转使用统一引用：

```ts
interface TraceableRef {
  entityType:
    | "sku_profile"
    | "sku_snapshot"
    | "health_diagnosis"
    | "activity"
    | "rule_set"
    | "simulation_run"
    | "simulation_result"
    | "review_item"
    | "workflow_run"
    | "workflow_step"
    | "agent_mission"
    | "agent_run"
    | "agent_tool_call"
    | "connector"
    | "report";
  entityId: string;
  label: string;
  href?: string;
  drawerTarget?: string;
}

interface EvidenceRef extends TraceableRef {
  sourceType: TraceableRef["entityType"];
  sourceId: string;
  field?: string;
  rawValue?: unknown;
  normalizedValue?: unknown;
  ruleId?: string;
  evidenceText?: string;
  collectedAt?: string;
}
```

全局状态条、铃铛、帮助入口建议由 shell 接口提供：

```http
GET /api/workbench/shell
```

```ts
interface WorkbenchShellDto {
  currentUser: {
    id: string;
    name: string;
    role: "op_team" | "qa_team" | "compliance_team" | "marketing_team" | string;
    teamName: string;
  };
  dataFreshness: {
    status: "GOOD" | "STALE" | "WARNING";
    label: string;
    staleCount: number;
    lastUpdatedAt?: string;
  };
  notifications: {
    unread: number;
    reviewDueSoon: number;
    failedRuns: number;
  };
}
```

## 3. 概览

用途：工作台首页，展示 SKU Ready 总览、活动执行状态、风险摘要、待办 Review、数据源新鲜度、最近 Agent 任务。

### 接口

```http
GET /api/dashboard/overview
```

```ts
interface DashboardOverviewDto {
  kpis: {
    totalSku: number;
    directReady: number;
    repairable: number;
    manualReview: number;
    blocked: number;
    readyRate: number;
  };
  dataFreshness: WorkbenchShellDto["dataFreshness"];
  activeActivity?: {
    activityId: string;
    name: string;
    status: "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED";
    activeRunId?: string;
    progressText: string;
  };
  riskSummary: Array<{
    reasonCode: string;
    label: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    affectedSkuCount: number;
    nextAction: string;
  }>;
  pendingReviews: Array<{
    reviewItemId: string;
    title: string;
    priority: "P0" | "P1" | "P2" | "P3" | "P4";
    dueAt?: string;
    assigneeRole?: string;
  }>;
  recentRuns: Array<{
    runId: string;
    title: string;
    status: string;
    startedAt: string;
    summary: string;
  }>;
}
```

当前后端状态：需新增。可由现有 `health summary + reviews + runs + connectors` 聚合。

## 4. SKU列表

原型页面：`SKU准入工作台`、旧版 `SKU 准入工作台`、右侧 SKU 详情抽屉。

### 4.1 列表

```http
GET /api/skus
```

Query：

```ts
interface SkuListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  platform?: string;
  category?: string;
  healthStatus?: "READY" | "REPAIRABLE" | "RISKY" | "BLOCKED";
  eligibilityStatus?: "DIRECT_READY" | "REPAIRABLE_READY" | "MANUAL_REVIEW" | "BLOCKED";
  certificateStatus?: string;
  activityId?: string;
  sortBy?: "sales30d" | "positiveRate" | "stock" | "updatedAt";
  sortOrder?: "asc" | "desc";
}
```

Response：

```ts
interface SkuListItemDto {
  skuProfileId: string;
  displaySku: string;
  productName: string;
  category?: string;
  sales30d?: number;
  positiveRate?: number;
  stock?: number;
  healthStatus: "READY" | "REPAIRABLE" | "RISKY" | "BLOCKED";
  eligibilityStatus?: "DIRECT_READY" | "REPAIRABLE_READY" | "MANUAL_REVIEW" | "BLOCKED";
  eligibilityLabel: string;
  nextAction: {
    type: "JOIN_ACTIVITY" | "REPAIR_ISSUE" | "VIEW_DETAIL" | "VIEW_BLOCKER" | "MANUAL_REVIEW";
    label: string;
    disabled?: boolean;
  };
  evidenceCount: number;
  updatedAt: string;
}
```

当前后端状态：已有基础 `/api/skus`，但 DTO 需扩展 `eligibilityStatus/displaySku/evidenceCount/nextAction`。

### 4.2 详情抽屉

```http
GET /api/skus/{skuProfileId}
```

```ts
interface SkuReadinessDetailDto {
  skuProfileId: string;
  displaySku: string;
  productName: string;
  category?: string;
  platform: string;
  storeId: string;
  statusSummary: {
    healthStatus: "READY" | "REPAIRABLE" | "RISKY" | "BLOCKED";
    eligibilityStatus?: "DIRECT_READY" | "REPAIRABLE_READY" | "MANUAL_REVIEW" | "BLOCKED";
    conclusion: string;
    nextStep: string;
  };
  readinessChecklist: Array<{
    id: string;
    label: string;
    status: "PASSED" | "FAILED" | "MISSING_DATA" | "MANUAL_REVIEW";
    evidenceRefs: EvidenceRef[];
  }>;
  evidenceOverview: {
    documentCount: number;
    dataCheckPassedCount: number;
    imageEvidenceCount: number;
    manualConfirmationCount: number;
  };
  latestSnapshot: Record<string, unknown> | null;
  latestDiagnosis: {
    diagnosisId: string;
    healthScore: number;
    dataQualityScore: number;
    issues: string[];
    nextActions: string[];
  } | null;
  relatedRules: TraceableRef[];
  relatedReviews: TraceableRef[];
}
```

### 4.3 批量动作

```http
POST /api/skus/bulk-review-items
POST /api/skus/export
POST /api/activities/{activityId}/candidate-skus
```

```ts
interface BulkSkuActionRequest {
  skuProfileIds: string[];
  activityId?: string;
  reasonCode?: string;
  comment?: string;
}
```

说明：

- `加入活动` 在 MVP 不直接报名，只创建候选清单或执行建议。
- `新建审核任务 / 批量生成 Review` 创建 `ReviewItem`。
- `导出` 返回导出任务或下载链接。

## 5. 活动管理

原型页面：`天猫618规则执行路径`、旧版 `规则执行路径`。

### 5.1 活动列表与详情

```http
GET /api/activities
POST /api/activities
GET /api/activities/{activityId}
PATCH /api/activities/{activityId}
```

```ts
interface ActivityDto {
  activityId: string;
  name: string;
  platform?: string;
  categoryScope?: string[];
  productScopeText: string;
  status: "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED";
  startAt?: string;
  endAt?: string;
  currentRuleSetId?: string;
  latestRunId?: string;
  createdAt: string;
  updatedAt: string;
}
```

当前后端状态：只有 rule parse/simulation，缺 `Activity` 聚合资源。

### 5.2 规则解析与执行路径

```http
POST /api/activities/{activityId}/rule-sets/parse
GET /api/activities/{activityId}/execution-plan
POST /api/activities/{activityId}/runs
```

```ts
interface ActivityExecutionPlanDto {
  activityId: string;
  runId?: string;
  ruleSet: {
    ruleSetId: string;
    version: string;
    parseStatus: "PARSED" | "NEEDS_REVIEW" | "FAILED";
    confidence: number;
    rules: CanonicalRuleDto[];
  };
  steps: Array<{
    stepKey:
      | "parse_rules"
      | "structure_rule_dsl"
      | "extract_required_fields"
      | "check_data_availability"
      | "simulate_readiness"
      | "generate_checklist";
    title: string;
    status: "DONE" | "RUNNING" | "WAITING" | "FAILED";
    owner: "SYSTEM" | "OPERATOR" | "AGENT";
    outputSummary?: string;
    toolName?: string;
    traceRef?: TraceableRef;
  }>;
  requiredFields: Array<{
    field: string;
    label: string;
    status: "READY" | "MISSING" | "STALE" | "EXTERNAL_DEPENDENCY" | "AMBIGUOUS_MAPPING";
    dataSource?: string;
    freshness?: string;
  }>;
  dataSources: Array<{
    connectorId: string;
    name: string;
    status: "AVAILABLE" | "STALE" | "FAILED" | "DELAYED";
    lastSyncedAt?: string;
  }>;
  pendingConfirmations: Array<{
    reviewItemId?: string;
    type: "RULE_AMBIGUITY" | "FIELD_MAPPING" | "DATA_SOURCE" | "RISK_ACTION";
    title: string;
    actionLabel: string;
  }>;
  relatedRuns: TraceableRef[];
}
```

### 5.3 运行准入模拟

```http
POST /api/activities/{activityId}/simulations
GET /api/activities/{activityId}/simulations/{simulationRunId}
```

说明：用于活动管理页和报告页，不允许前端重新计算准入结论。

## 6. 任务与运行

原型页面：`Agent Mission（聊天式任务控制台）`、旧版 `Run #20250509-1041`、Agent Mission 侧栏。

### 6.1 Agent Mission

```http
GET /api/agent/missions
POST /api/agent/missions
GET /api/agent/missions/{missionId}
POST /api/agent/missions/{missionId}/runs
```

```ts
interface AgentMissionDto {
  missionId: string;
  sessionId: string;
  objective: string;
  autonomyLevel: "L1_READ_ONLY" | "L2_REVIEW_GATED_AGENT";
  status: "PLANNING" | "RUNNING" | "WAITING_FOR_DATA" | "WAITING_FOR_REVIEW" | "COMPLETED" | "FAILED" | "CANCELED";
  currentRunId?: string;
  plan: ActivityExecutionPlanDto["steps"];
  evidenceSummary: {
    available: number;
    missing: number;
    needManualConfirmation: number;
    conflicting: number;
  };
  latestToolCalls: AgentToolCallSummaryDto[];
  createdAt: string;
  updatedAt: string;
}

interface AgentToolCallSummaryDto {
  toolCallId: string;
  toolName: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "BLOCKED_BY_POLICY" | "WAITING_FOR_APPROVAL";
  startedAt?: string;
  durationMs?: number;
  traceRef: TraceableRef;
}
```

### 6.2 Run 详情与事件流

```http
GET /api/agent/runs/{runId}
GET /api/agent/runs/{runId}/events?after={sequence}
GET /api/agent/runs/{runId}/events?after={sequence}&stream=1
POST /api/agent/runs/{runId}/pause
POST /api/agent/runs/{runId}/cancel
POST /api/agent/review-gates/{gateId}/decision
```

```ts
interface AgentRunDetailDto {
  runId: string;
  missionId: string;
  title: string;
  status: "QUEUED" | "RUNNING" | "WAITING_REVIEW" | "SUCCEEDED" | "FAILED" | "CANCELED";
  startedAt: string;
  completedAt?: string;
  currentStage: {
    index: number;
    total: number;
    label: string;
  };
  stepTimeline: ActivityExecutionPlanDto["steps"];
  toolRuns: AgentToolCallSummaryDto[];
  anomalies: Array<{
    type: "LOW_CONFIDENCE" | "STALE_DATA" | "MISSING_DATA" | "POLICY_BLOCKED";
    title: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    evidenceRefs: EvidenceRef[];
  }>;
  reviewGates: Array<{
    gateId: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED";
    question: string;
    evidenceRefs: EvidenceRef[];
    reviewItemRef?: TraceableRef;
  }>;
}
```

当前后端状态：已有 mission/run/events/review-gate route，但 EventStore 仍需换成持久化；SSE 需改为可持续推送。

### 6.3 Run 内问答

```http
POST /api/agent/runs/{runId}/questions
```

```ts
interface RunQuestionRequest {
  question: string;
  scope: "CURRENT_RUN_ONLY";
}

interface RunQuestionAnswerDto {
  answer: string;
  evidenceRefs: EvidenceRef[];
  relatedRules: TraceableRef[];
  relatedToolCalls: TraceableRef[];
}
```

## 7. Review工作台

原型页面：新版 `Review 工作台`、旧版 `Review 工作台`。

### 7.1 Review 列表

```http
GET /api/reviews
```

Query：

```ts
interface ReviewListQuery {
  page?: number;
  pageSize?: number;
  tab?: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "DRAFT";
  type?: "REPLENISHMENT" | "CERTIFICATE" | "RULE_AMBIGUITY" | "ACTIVITY_CONFLICT" | "PRICE" | "AGENT_REVIEW_GATE";
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  status?: string;
  assigneeRole?: string;
  dueFrom?: string;
  dueTo?: string;
  q?: string;
}
```

```ts
interface ReviewListItemDto {
  reviewItemId: string;
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  type: ReviewListQuery["type"];
  title: string;
  summary: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "DRAFT";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  assignee: {
    userId?: string;
    name: string;
    team: string;
  };
  dueAt?: string;
  evidenceSummary: string;
}
```

### 7.2 Review 详情与决策

```http
GET /api/reviews/{reviewItemId}
POST /api/reviews/{reviewItemId}/decision
PATCH /api/reviews/{reviewItemId}
```

```ts
interface ReviewDetailDto extends ReviewListItemDto {
  recommendation: {
    actionType: "REPLENISH_STOCK" | "UPLOAD_CERTIFICATE" | "CONFIRM_RULE" | "EXCLUDE_SKU" | "CONFIRM_MAPPING";
    content: string;
    expectedEffect?: string;
    metrics?: Array<{ label: string; value: string | number }>;
  };
  riskIfIgnored: string;
  evidenceRefs: EvidenceRef[];
  relatedRules: TraceableRef[];
  relatedRun?: TraceableRef;
  approvalHistory: Array<{
    actor: string;
    action: string;
    comment?: string;
    createdAt: string;
  }>;
}

interface ReviewDecisionRequest {
  decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES";
  decisionBy: string;
  decisionComment?: string;
  modifiedPayload?: Record<string, unknown>;
}
```

## 8. 报告中心

原型页面：新版 `报告中心`。

### 8.1 报告列表与详情

```http
GET /api/reports
POST /api/reports
GET /api/reports/{reportId}
GET /api/reports/{reportId}/versions
GET /api/reports/{reportId}/versions/{versionId}
POST /api/reports/{reportId}/export
POST /api/reports/{reportId}/subscriptions
```

```ts
interface ReportDetailDto {
  reportId: string;
  title: string;
  version: string;
  status: "GENERATING" | "PREVIEW" | "COMPLETED" | "FAILED";
  activity?: TraceableRef;
  sourceRun?: TraceableRef;
  generatedAt: string;
  activityWindow?: { startAt: string; endAt: string };
  tabs: Array<"SUMMARY" | "TASKS" | "RULES" | "EVIDENCE" | "REPAIRS">;
  summary: {
    totalSku: number;
    passedSku: number;
    repairableSku: number;
    blockedSku: number;
    categoryDistribution: Array<{
      category: string;
      passed: number;
      repairable: number;
      blocked: number;
      passRate: number;
    }>;
    majorRisks: Array<{
      riskType: string;
      affectedSku: number;
      ratio: number;
      sampleIssue: string;
    }>;
    repairSuggestions: Array<{
      priority: "P0" | "P1" | "P2";
      suggestion: string;
      affectedSku: number;
      estimatedLift: string;
    }>;
    reviewResult: {
      total: number;
      completed: number;
      approved: number;
      rejected: number;
    };
  };
  evidenceSummary: EvidenceRef[];
}
```

当前后端状态：已有 `POST /api/reports` 预览，需补列表、版本、导出、订阅。

## 9. 数据源

原型页面：新版 `数据源连接器`、旧版插件侧边栏。

### 9.1 连接器列表与详情

```http
GET /api/connectors
POST /api/connectors
GET /api/connectors/{connectorId}
PATCH /api/connectors/{connectorId}
POST /api/connectors/{connectorId}/sync-runs
GET /api/connectors/{connectorId}/sync-runs
GET /api/connector-runs/{connectorRunId}
```

```ts
interface ConnectorDto {
  connectorId: string;
  name: string;
  type: "BROWSER_EXTENSION" | "ERP" | "PLATFORM_API" | "CSV" | "CRM";
  status: "RUNNING" | "PAUSED" | "FAILED" | "NEEDS_AUTH";
  lastSyncedAt?: string;
  freshnessLabel: string;
  configSummary: {
    pluginVersion?: string;
    collectionScope?: string;
    fieldCount?: number;
    frequency?: string;
    dedupeRule?: string;
    storageTarget?: string;
  };
  permissionSummary: {
    authorizedDomains: number;
    accountPermission: "READ" | "READ_WRITE" | "NONE";
    dataVisibility: "CURRENT_TEAM" | "WORKSPACE" | "PRIVATE";
  };
}

interface ConnectorRunDto {
  connectorRunId: string;
  connectorId: string;
  sourceName: string;
  status: "SUCCEEDED" | "FAILED" | "RUNNING";
  collectedRows: number;
  freshnessLabel: string;
  evidenceQuality: "HIGH" | "MEDIUM" | "LOW";
  evidenceScore: number;
  startedAt: string;
  completedAt?: string;
  warnings: Array<{ code: string; message: string; severity: string }>;
}
```

### 9.2 插件侧边栏采集

```http
POST /api/connectors/browser/page-detection
POST /api/connectors/browser/scan-preview
POST /api/ingest
POST /api/agent/missions
```

```ts
interface BrowserPageDetectionRequest {
  url: string;
  title?: string;
  host?: string;
  tableHeaders?: string[];
}

interface BrowserScanPreviewDto {
  pageType: "SKU_LIST" | "SKU_DETAIL" | "UNKNOWN";
  storeName?: string;
  permissionScope: string;
  adapterKey: string;
  scanProgress: number;
  collectedSkuCount: number;
  totalSkuCount?: number;
  dataQualityScore: number;
  findings: Array<{
    reasonCode: string;
    label: string;
    count: number;
    severity: "INFO" | "WARNING" | "HIGH";
  }>;
  fieldMapping: Array<{
    sourceField: string;
    targetField: string;
    confidence: number;
  }>;
}
```

当前后端状态：`POST /api/ingest` 已有；连接器管理、scan preview 需新增。

## 10. 规则库

原型页面：新版 `规则库 / 活动规则 DSL 与版本`。

### 10.1 规则集列表与详情

```http
GET /api/rule-sets
POST /api/rule-sets
GET /api/rule-sets/{ruleSetId}
PATCH /api/rule-sets/{ruleSetId}
POST /api/rule-sets/{ruleSetId}/versions
GET /api/rule-sets/{ruleSetId}/versions
POST /api/rule-sets/{ruleSetId}/enable
POST /api/rule-sets/{ruleSetId}/disable
```

```ts
interface RuleSetListItemDto {
  ruleSetId: string;
  name: string;
  type: "ACTIVITY_RULE" | "QUALIFICATION_RULE" | "CONTENT_RULE";
  version: string;
  status: "ENABLED" | "DRAFT" | "DISABLED";
  source: "PLATFORM" | "INTERNAL";
  updatedAt: string;
  updatedBy: string;
  activeRunCount: number;
}

interface RuleSetDetailDto extends RuleSetListItemDto {
  summary: {
    ruleCount: number;
    validationMode: "BLOCK_AND_HINT" | "HINT_ONLY";
    failureHandling: "BLOCK" | "MANUAL_REVIEW" | "WARN";
    priority: "P0" | "P1" | "P2";
    scopeText: string;
    linkedDataSources: string[];
  };
  dslJson: CanonicalRuleDto[];
  affectedFields: Array<{
    field: string;
    label: string;
    required: boolean;
    dataSources: TraceableRef[];
  }>;
  manualReviewItems: Array<{
    reasonCode: string;
    question: string;
    confidence?: number;
  }>;
  relatedRuns: TraceableRef[];
}
```

当前后端状态：已有 `ActivityRuleSet` schema 与 parse service，需把 activity rule set 抽成正式 rule-set 管理接口。

## 11. 设置

原型只有一级入口，建议 P0 只保留必要配置：

```http
GET /api/settings/workspace
PATCH /api/settings/workspace
GET /api/settings/tool-policy
PATCH /api/settings/tool-policy
GET /api/settings/users
```

```ts
interface WorkspaceSettingsDto {
  workspaceId: string;
  name: string;
  defaultTenantId: string;
  dataFreshnessThresholdHours: number;
  reviewSlaHours: {
    high: number;
    medium: number;
    low: number;
  };
  allowedAgentTools: string[];
  deniedRuntimeTools: string[];
}
```

## 12. 当前已有接口与新增接口对照

已有且可继续使用：

- `POST /api/ingest`
- `GET /api/health/summary`
- `GET /api/skus`
- `GET /api/skus/{skuProfileId}`
- `POST /api/activities/parse`
- `GET /api/activities`
- `POST /api/activities`
- `GET /api/activities/{activityId}`
- `PATCH /api/activities/{activityId}`
- `GET /api/activities/{activityId}/execution-plan`
- `POST /api/activities/{activityId}/rule-sets/parse`
- `POST /api/activities/{activityId}/runs`
- `POST /api/activities/{activityId}/simulations`
- `GET /api/activities/{activityId}/simulations/{simulationRunId}`
- `GET /api/reviews`
- `POST /api/reviews`
- `POST /api/reviews/{reviewItemId}/decision`
- `POST /api/reports`
- `POST /api/agent/missions`
- `POST /api/agent/missions/{missionId}/runs`
- `GET /api/agent/runs/{runId}/events`
- `POST /api/agent/review-gates/{gateId}/decision`
- `POST /api/agent/pi/smoke`

建议新增：

- `GET /api/workbench/shell`
- `GET /api/dashboard/overview`
- `GET /api/agent/missions`
- `GET /api/agent/missions/{missionId}`
- `GET /api/agent/runs/{runId}`
- `POST /api/agent/runs/{runId}/pause`
- `POST /api/agent/runs/{runId}/cancel`
- `POST /api/agent/runs/{runId}/questions`
- `GET /api/reviews/{reviewItemId}`
- `PATCH /api/reviews/{reviewItemId}`
- `GET /api/reports`
- `GET /api/reports/{reportId}`
- `GET /api/reports/{reportId}/versions`
- `POST /api/reports/{reportId}/export`
- `POST /api/reports/{reportId}/subscriptions`
- `GET /api/connectors`
- `POST /api/connectors`
- `GET /api/connectors/{connectorId}`
- `PATCH /api/connectors/{connectorId}`
- `POST /api/connectors/{connectorId}/sync-runs`
- `GET /api/connectors/{connectorId}/sync-runs`
- `GET /api/connector-runs/{connectorRunId}`
- `POST /api/connectors/browser/page-detection`
- `POST /api/connectors/browser/scan-preview`
- `GET /api/rule-sets`
- `POST /api/rule-sets`
- `GET /api/rule-sets/{ruleSetId}`
- `PATCH /api/rule-sets/{ruleSetId}`
- `POST /api/rule-sets/{ruleSetId}/versions`
- `GET /api/rule-sets/{ruleSetId}/versions`
- `POST /api/rule-sets/{ruleSetId}/enable`
- `POST /api/rule-sets/{ruleSetId}/disable`
- `GET /api/settings/workspace`
- `PATCH /api/settings/workspace`
- `GET /api/settings/tool-policy`
- `PATCH /api/settings/tool-policy`

## 13. 前端组件拆分建议

按一级菜单拆模块，不按旧版页面名拆：

- `app-shell`：Sidebar、Topbar、WorkbenchShellProvider、DataFreshnessBadge、NotificationBell
- `overview`：DashboardOverviewPage、RiskSummaryCard、ActiveRunCard、PendingReviewList
- `sku`：SkuListPage、SkuFilterBar、SkuTable、SkuReadinessDrawer、EvidenceOverviewCards
- `activity`：ActivityListPage、ActivityExecutionPathPage、RuleSummaryPanel、RequiredFieldsPanel、RunChecklistTable
- `agent-run`：AgentMissionPage、MissionChatTimeline、RunMonitorPanel、ToolTraceList、ReviewGatePanel
- `review`：ReviewWorkbenchPage、ReviewTable、ReviewDetailDrawer、ReviewDecisionBar
- `report`：ReportCenterPage、ReportVersionList、ReportSummaryTabs、ReportExportPanel
- `connector`：ConnectorPage、ConnectorList、ConnectorDetailDrawer、ConnectorRunTable、BrowserScanPanel
- `rule-set`：RuleSetPage、RuleSetTable、RuleSetDetailPanel、DslPreviewPanel、AffectedFieldsTab
- `settings`：WorkspaceSettingsPage、ToolPolicyPanel

约束：

- 页面组件只消费 DTO，不自行计算健康、准入、Review 结论。
- 列表页消费 projection / summary DTO，详情抽屉消费聚合 detail DTO。
- Evidence、规则、Run、Tool Trace、Review Gate 必须可点击，不展示不可追溯的静态文字。
- L2 以上动作只创建建议或 Review Gate，不直接执行改价、报名、修改商品信息。
