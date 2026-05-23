import {
  mockConnectorConsole,
  mockDashboardSummary,
  mockSkuDetails,
} from '@/modules/staff-health-console/mock-fixtures'
import type {
  ConnectorConsoleDto,
  ConnectorDto,
  ConnectorStatus,
  CurrentSkuProjectionDto,
  DashboardMetricDto,
  DashboardSummaryDto,
  HealthStatus,
  RecentWorkflowRunDto,
  SkuDetailDto,
  SkuEvidenceDto,
  SkuIssueDto,
  StatusTone,
  WorkflowRunStatus,
} from '@/modules/staff-health-console/contracts'

type BackendHealthStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'UNKNOWN'

interface BackendHealthSummary {
  total: number
  ready: number
  warning: number
  blocked: number
  dataQualityScore?: number
}

interface BackendSkuSummary {
  skuProfileId: string
  canonicalSkuKey: string
  productName: string
  platform: string
  storeId: string
  healthStatus: BackendHealthStatus
  healthScore: number
  dataQualityScore: number
  topIssues: string[]
  nextActions: string[]
}

interface BackendSkuDetail extends BackendSkuSummary {
  latestSnapshot: {
    collectedAt?: string
    category?: string
    originalPrice?: number
    lowestPrice30d?: number
    campaignPrice?: number
    stock?: number
    certificateStatus?: string
  } | null
  latestDiagnosis: {
    diagnosedAt?: string
    issues?: string[]
    nextActions?: string[]
  } | null
  evidence: Array<{
    type: string
    entityId: string
    label: string
    summary: string
  }>
}

interface BackendConnector {
  id: string
  name?: string
  platform?: string
  status?: string
  lastIngestedAt?: string | null
  lastIngestSummary?: string
  capabilityBoundary?: string
}

interface BackendWorkflowRun {
  id: string
  workflowType?: string
  status?: string
  subjectType?: string
  subjectId?: string
  completedAt?: string | null
  startedAt?: string | null
  updatedAt?: string | null
}

const apiBaseUrl = process.env.PICKAGENT_QUERY_API_BASE_URL ?? process.env.NEXT_PUBLIC_PICKAGENT_QUERY_API_BASE_URL

export async function getDashboardSummary(): Promise<DashboardSummaryDto> {
  const [summary, runs] = await Promise.all([fetchBackend<BackendHealthSummary>('/api/v1/health/summary'), fetchList<BackendWorkflowRun>('/api/v1/workflow-runs?pageSize=3')])

  if (!summary) return mockDashboardSummary

  return {
    metrics: dashboardMetricsFromSummary(summary),
    riskSummaries: [
      {
        id: 'repairable-or-risky',
        label: '需修复或复核',
        count: summary.warning,
        description: '来自服务端 summary 查询的 WARNING/RISKY 当前状态聚合。',
        targetHref: '/sku-health',
        tone: 'warning',
      },
      {
        id: 'blocked',
        label: '阻断 SKU',
        count: summary.blocked,
        description: '服务端 projection 标记为 BLOCKED 的 SKU，需要先补齐证据或库存。',
        targetHref: '/sku-health',
        tone: 'blocked',
      },
      {
        id: 'collection-gap',
        label: '采集缺口风险',
        count: summary.warning + summary.blocked,
        description: '价格字段和类目名称缺口按采集风险展示，不在前端推导健康结论。',
        targetHref: '/connectors',
        tone: 'review',
      },
    ],
    recentRuns: runs.length > 0 ? runs.map(toRecentRun) : mockDashboardSummary.recentRuns,
    primaryLinks: mockDashboardSummary.primaryLinks,
  }
}

export async function getConnectorConsole(): Promise<ConnectorConsoleDto> {
  const connectors = await fetchList<BackendConnector>('/api/v1/connectors?pageSize=20')
  if (connectors.length === 0) return mockConnectorConsole

  return {
    connectors: connectors.map(toConnector),
    collectionBoundaries: [
      ...mockConnectorConsole.collectionBoundaries.filter((boundary) => boundary.id !== 'mock-first'),
      {
        id: 'layer3-query-adapter',
        label: '真实查询优先',
        description: '页面优先读取后端 connector/query DTO；接口不可用时回退 mock fixture，不保存 Cookie 或 token。',
      },
      {
        id: 'price-category-gap',
        label: '价格与类目缺口',
        description: '抖店库存接口缺少销售价和类目名称时，只展示为采集风险，等待后续采集源补齐。',
      },
    ],
  }
}

export async function getSkuList(): Promise<CurrentSkuProjectionDto[]> {
  const skus = await fetchList<BackendSkuSummary>('/api/v1/current-sku-projections?pageSize=100')
  if (skus.length === 0) return mockSkuDetails.map((detail) => detail.projection)

  return skus.map(toProjection)
}

export async function getSkuDetail(skuProfileId?: string): Promise<SkuDetailDto> {
  if (!skuProfileId) return mockSkuDetails[0]

  const detail = await fetchBackend<BackendSkuDetail>(`/api/v1/skus/${encodeURIComponent(skuProfileId)}`)
  if (!detail) {
    const projection = (await getSkuList()).find((item) => item.skuProfileId === skuProfileId)
    if (projection) return detailFromProjection(projection)
    return mockSkuDetails.find((item) => item.projection.skuProfileId === skuProfileId) ?? mockSkuDetails[0]
  }

  return toSkuDetail(detail)
}

export const realQueryIntegrationDependency =
  'Layer 3 已接入真实 summary / connector / sku / workflow 查询 adapter；接口不可用或未配置 PICKAGENT_QUERY_API_BASE_URL 时保留 mock fallback。'

async function fetchList<T>(path: string): Promise<T[]> {
  const response = await fetchBackend<{ items?: T[] } | T[]>(path)
  if (Array.isArray(response)) return response
  return response?.items ?? []
}

async function fetchBackend<T>(path: string): Promise<T | null> {
  if (!apiBaseUrl) return null

  try {
    const response = await fetch(new URL(path, apiBaseUrl), { cache: 'no-store' })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

function dashboardMetricsFromSummary(summary: BackendHealthSummary): DashboardMetricDto[] {
  const repairable = summary.warning
  const dataQuality = summary.dataQualityScore ?? 0

  return [
    { id: 'scope', label: '监控 SKU', value: String(summary.total), description: '来自后端 health summary 查询。', tone: 'neutral' },
    { id: 'ready', label: 'Ready', value: String(summary.ready), description: '服务端 projection 当前为 READY。', tone: 'ready' },
    { id: 'repairable', label: 'Repairable', value: String(repairable), description: '后端 WARNING 状态映射为前端可修复/复核展示。', tone: 'review' },
    { id: 'blocked', label: 'Blocked', value: String(summary.blocked), description: '服务端 projection 当前为 BLOCKED。', tone: 'blocked' },
    {
      id: 'quality',
      label: '数据质量',
      value: dataQuality > 0 ? `${dataQuality}%` : '待补',
      description: '仅展示服务端 summary DTO；无字段时不在前端重算。',
      tone: dataQuality >= 80 ? 'ready' : 'review',
    },
  ]
}

function toProjection(summary: BackendSkuSummary): CurrentSkuProjectionDto {
  const issueSummary = summary.topIssues.length > 0 ? summary.topIssues.join('；') : '当前 projection 未返回阻断问题。'
  const nextAction = summary.nextActions.length > 0 ? summary.nextActions.join('；') : '保持监控，等待下一次服务端刷新。'

  return {
    skuProfileId: summary.skuProfileId,
    canonicalSkuKey: summary.canonicalSkuKey,
    productName: summary.productName,
    platform: summary.platform,
    storeName: summary.storeId,
    healthStatus: toUiHealthStatus(summary.healthStatus, summary.healthScore),
    healthScore: summary.healthScore,
    dataQualityScore: summary.dataQualityScore,
    issueSummary,
    nextAction,
    updatedAtLabel: '来自真实 query',
    targetHref: `/sku-health/${summary.skuProfileId}`,
  }
}

function toSkuDetail(detail: BackendSkuDetail): SkuDetailDto {
  const projection = toProjection(detail)
  const collectionRisks = collectionRiskIssues(detail)
  const diagnosisIssues = detail.latestDiagnosis?.issues ?? detail.topIssues
  const issues: SkuIssueDto[] = [
    ...diagnosisIssues.map((issue, index) => ({
      id: `issue-${index}`,
      severity: issueTone(projection.healthStatus),
      title: issue,
      summary: issue,
    })),
    ...collectionRisks,
  ]

  return {
    projection: {
      ...projection,
      updatedAtLabel: formatDateLabel(detail.latestDiagnosis?.diagnosedAt ?? detail.latestSnapshot?.collectedAt),
    },
    issues,
    evidence: toEvidence(detail),
    nextActions: (detail.latestDiagnosis?.nextActions ?? detail.nextActions).map((action, index) => ({
      id: `action-${index}`,
      title: action,
      description: action,
      owner: '服务端 DTO',
    })),
  }
}

function detailFromProjection(projection: CurrentSkuProjectionDto): SkuDetailDto {
  return {
    projection,
    issues: projection.issueSummary
      ? [
          {
            id: 'projection-issue-summary',
            severity: issueTone(projection.healthStatus),
            title: 'Projection 问题摘要',
            summary: projection.issueSummary,
          },
        ]
      : [],
    evidence: [
      {
        id: 'projection',
        label: 'CurrentSkuProjection',
        value: projection.skuProfileId,
        source: '真实 projection list 查询；detail 查询不可用时的最小详情 fallback。',
      },
    ],
    nextActions: [
      {
        id: 'projection-next-action',
        title: projection.nextAction,
        description: projection.nextAction,
        owner: '服务端 projection',
      },
    ],
  }
}

function collectionRiskIssues(detail: BackendSkuDetail): SkuIssueDto[] {
  const risks: SkuIssueDto[] = []
  if (!hasAnyPrice(detail.latestSnapshot)) {
    risks.push({
      id: 'collection-price-gap',
      severity: 'review',
      title: '价格采集缺口',
      summary: '当前真实查询未返回销售价或近 30 天价格字段，按采集风险展示。',
    })
  }
  if (!detail.latestSnapshot?.category) {
    risks.push({
      id: 'collection-category-gap',
      severity: 'review',
      title: '类目名称采集缺口',
      summary: '当前真实查询未返回类目名称，保留 category_id 或等待后续采集源补齐。',
    })
  }
  return risks
}

function toEvidence(detail: BackendSkuDetail): SkuEvidenceDto[] {
  const fromBackend = detail.evidence.map((item) => ({
    id: `${item.type}-${item.entityId}`,
    label: item.label,
    value: item.entityId,
    source: item.summary,
  }))
  const snapshot = detail.latestSnapshot
  return [
    ...fromBackend,
    { id: 'stock', label: '可售库存', value: valueOrMissing(snapshot?.stock), source: 'Latest snapshot DTO' },
    { id: 'price', label: '价格字段', value: hasAnyPrice(snapshot) ? '已返回' : '缺失', source: 'Latest snapshot DTO' },
    { id: 'category', label: '类目字段', value: snapshot?.category ?? '缺失', source: 'Latest snapshot DTO' },
  ]
}

function toConnector(connector: BackendConnector): ConnectorDto {
  return {
    id: connector.id,
    name: connector.name ?? connector.id,
    platform: connector.platform ?? 'Unknown',
    status: toConnectorStatus(connector.status),
    lastIngestedAtLabel: formatDateLabel(connector.lastIngestedAt),
    lastIngestSummary: connector.lastIngestSummary ?? '真实 connector 查询未返回最近采集摘要。',
    capabilityBoundary: connector.capabilityBoundary ?? '只展示连接状态与采集摘要，不控制插件自动化。',
    targetHref: '/workflows',
  }
}

function toRecentRun(run: BackendWorkflowRun): RecentWorkflowRunDto {
  return {
    id: run.id,
    title: run.workflowType ?? run.id,
    source: run.subjectType ? `${run.subjectType}:${run.subjectId ?? 'unknown'}` : 'Workflow query',
    status: toWorkflowStatus(run.status),
    finishedAtLabel: formatDateLabel(run.completedAt ?? run.updatedAt ?? run.startedAt),
    targetHref: '/workflows',
    summary: '来自真实 workflow run 查询的最近运行摘要。',
  }
}

function toUiHealthStatus(status: BackendHealthStatus, score: number): HealthStatus {
  if (status === 'READY') return 'READY'
  if (status === 'BLOCKED') return 'BLOCKED'
  if (status === 'WARNING') return score >= 50 ? 'REPAIRABLE' : 'RISKY'
  return 'RISKY'
}

function toConnectorStatus(status?: string): ConnectorStatus {
  if (status === 'CONNECTED' || status === 'DEGRADED' || status === 'DISCONNECTED' || status === 'SETUP_REQUIRED') return status
  if (status === 'ACTIVE') return 'CONNECTED'
  if (status === 'ERROR') return 'DEGRADED'
  return 'SETUP_REQUIRED'
}

function toWorkflowStatus(status?: string): WorkflowRunStatus {
  if (status === 'SUCCEEDED' || status === 'RUNNING' || status === 'WAITING_FOR_REVIEW' || status === 'FAILED') return status
  if (status === 'COMPLETED') return 'SUCCEEDED'
  if (status === 'PENDING_REVIEW') return 'WAITING_FOR_REVIEW'
  return 'RUNNING'
}

function issueTone(status: HealthStatus): StatusTone {
  if (status === 'BLOCKED') return 'blocked'
  if (status === 'RISKY') return 'warning'
  return 'review'
}

function hasAnyPrice(snapshot: BackendSkuDetail['latestSnapshot']): boolean {
  return snapshot?.originalPrice !== undefined || snapshot?.lowestPrice30d !== undefined || snapshot?.campaignPrice !== undefined
}

function valueOrMissing(value: number | string | undefined): string {
  return value === undefined ? '缺失' : String(value)
}

function formatDateLabel(value?: string | null): string {
  if (!value) return '未返回'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
