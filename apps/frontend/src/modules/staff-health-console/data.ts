import { headers } from 'next/headers'

import type {
  ApiViewState,
  ConnectorConsoleDto,
  ConnectorDto,
  CurrentSkuProjectionDto,
  DashboardMetricDto,
  DashboardSummaryDto,
  HealthStatus,
  RecentWorkflowRunDto,
  SkuDetailDto,
  SkuEvidenceDto,
  SkuIssueDto,
  StatusTone,
} from '@/modules/staff-health-console/contracts'

type BackendHealthStatus = 'READY' | 'WARNING' | 'BLOCKED' | 'UNKNOWN'

interface ApiEnvelope<T> {
  code: string
  message: string
  data: T | null
  requestId: string
}

interface PageDto<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

interface BackendHealthSummary {
  total: number
  ready: number
  warning: number
  blocked: number
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
    snapshotId: string
    skuProfileId: string
    collectedAt: string
    productName: string
    category?: string
    brand?: string
    sales30d?: number
    positiveRate?: number
    stock?: number
    originalPrice?: number
    lowestPrice30d?: number
    campaignPrice?: number
    joinedBrandDay?: boolean
    certificateStatus?: string
  } | null
  latestDiagnosis: {
    diagnosisId: string
    skuProfileId: string
    snapshotId: string
    healthStatus: BackendHealthStatus
    healthScore: number
    dataQualityScore: number
    issues: string[]
    nextActions: string[]
    diagnosedAt: string
  } | null
  evidence: Array<{
    type: string
    entityId: string
    label: string
    summary: string
  }>
}

type ApiResult<T> =
  | { ok: true; data: T; requestId: string; endpoint: string }
  | { ok: false; reason: string; requestId?: string; endpoint: string }

const STAFF_HEALTH_ENDPOINTS = {
  summary: '/api/health/summary',
  skuList: '/api/skus?pageSize=100',
  skuDetail: (skuProfileId: string) => `/api/skus/${encodeURIComponent(skuProfileId)}`,
} as const

const primaryLinks = [
  { label: '查看数据源', href: '/data-sources', description: '确认采集来源、最近运行和边界说明' },
  { label: '查看 SKU 列表', href: '/sku-access', description: '按服务端 projection 浏览当前健康状态' },
  { label: '查看运行日志', href: '/run-console', description: '进入运行日志视图查看长任务状态' },
]

const collectionBoundaries = [
  {
    id: 'no-plugin-control',
    label: '不控制插件自动化',
    description: '员工工作台只展示连接状态和采集摘要，不承担插件运行流程控制。',
  },
  {
    id: 'no-health-recalc',
    label: '不重算健康结论',
    description: '页面只消费 summary、projection 和 detail DTO，不拼 snapshot 与 diagnosis。',
  },
  {
    id: 'real-api-default',
    label: '真实 API 默认路径',
    description: 'SKU Health 默认请求 /api/health/summary、/api/skus、/api/skus/:skuProfileId。',
  },
]

export async function getDashboardSummary(): Promise<DashboardSummaryDto> {
  const result = await fetchApi<BackendHealthSummary>(STAFF_HEALTH_ENDPOINTS.summary)

  if (!result.ok) {
    return {
      metrics: dashboardMetricsFromSummary({ total: 0, ready: 0, warning: 0, blocked: 0 }),
      riskSummaries: [],
      recentRuns: [],
      primaryLinks,
      viewState: fallbackState(result.endpoint, result.reason),
    }
  }

  if (result.data.total === 0) {
    return {
      metrics: dashboardMetricsFromSummary(result.data),
      riskSummaries: [],
      recentRuns: [],
      primaryLinks,
      viewState: emptyState(result.endpoint, result.requestId, '真实 health summary 已返回，但当前没有 ingest 后的 SKU projection。'),
    }
  }

  return {
    metrics: dashboardMetricsFromSummary(result.data),
    riskSummaries: riskSummariesFromSummary(result.data),
    recentRuns: recentRunsFromSummary(result.data),
    primaryLinks,
    viewState: realState(result.endpoint, result.requestId),
  }
}

export async function getConnectorConsole(): Promise<ConnectorConsoleDto> {
  const [summaryResult, skuListResult] = await Promise.all([
    fetchApi<BackendHealthSummary>(STAFF_HEALTH_ENDPOINTS.summary),
    fetchApi<PageDto<BackendSkuSummary>>(STAFF_HEALTH_ENDPOINTS.skuList),
  ])

  if (!summaryResult.ok && !skuListResult.ok) {
    return {
      connectors: connectorApiRows(summaryResult, skuListResult),
      collectionBoundaries,
      viewState: fallbackState(`${summaryResult.endpoint}, ${skuListResult.endpoint}`, `${summaryResult.reason}; ${skuListResult.reason}`),
    }
  }

  return {
    connectors: connectorApiRows(summaryResult, skuListResult),
    collectionBoundaries,
    viewState: skuListResult.ok || summaryResult.ok ? realState('/api/health/summary + /api/skus', skuListResult.ok ? skuListResult.requestId : summaryResult.requestId) : fallbackState('/api/health/summary + /api/skus', 'health API 不可用'),
  }
}

export async function getSkuList(): Promise<{ items: CurrentSkuProjectionDto[]; viewState: ApiViewState }> {
  const result = await fetchApi<PageDto<BackendSkuSummary>>(STAFF_HEALTH_ENDPOINTS.skuList)

  if (!result.ok) {
    return { items: [], viewState: fallbackState(result.endpoint, result.reason) }
  }

  if (result.data.items.length === 0) {
    return { items: [], viewState: emptyState(result.endpoint, result.requestId, '真实 SKU list 已返回，但当前没有 ingest 后的 projection。') }
  }

  return { items: result.data.items.map(toProjection), viewState: realState(result.endpoint, result.requestId) }
}

export async function getSkuDetail(skuProfileId?: string): Promise<SkuDetailDto | null> {
  if (!skuProfileId) {
    return null
  }

  const result = await fetchApi<BackendSkuDetail>(STAFF_HEALTH_ENDPOINTS.skuDetail(skuProfileId))
  if (!result.ok) {
    const list = await getSkuList()
    const projection = list.items.find((item) => item.skuProfileId === skuProfileId)
    return projection
      ? detailFromProjection(projection, fallbackState(result.endpoint, result.reason))
      : null
  }

  return { ...toSkuDetail(result.data), viewState: realState(result.endpoint, result.requestId) }
}

export const realQueryIntegrationDependency =
  'Layer 4B 已将员工健康工作台默认数据源收口到 GET /api/health/summary、GET /api/skus、GET /api/skus/:skuProfileId；接口错误或空数据时显示空态，不使用 mock 数据冒充真实闭环。'

async function fetchApi<T>(path: string): Promise<ApiResult<T>> {
  const endpoint = path

  try {
    const response = await fetch(await apiUrl(path), { cache: 'no-store' })
    const envelope = (await response.json()) as ApiEnvelope<T>
    if (!response.ok || envelope.code !== 'OK' || envelope.data === null) {
      return { ok: false, endpoint, requestId: envelope.requestId, reason: `${envelope.code}: ${envelope.message}` }
    }
    return { ok: true, endpoint, requestId: envelope.requestId, data: envelope.data }
  } catch (error) {
    return { ok: false, endpoint, reason: error instanceof Error ? error.message : 'API request failed' }
  }
}

async function apiUrl(path: string): Promise<URL> {
  const configured = process.env.PICKAGENT_QUERY_API_BASE_URL ?? process.env.NEXT_PUBLIC_PICKAGENT_QUERY_API_BASE_URL
  if (configured) return new URL(path, configured)

  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3000'
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  return new URL(path, `${protocol}://${host}`)
}

function dashboardMetricsFromSummary(summary: BackendHealthSummary): DashboardMetricDto[] {
  return [
    { id: 'scope', label: '监控 SKU', value: String(summary.total), description: '来自 GET /api/health/summary 的 total。', tone: 'neutral' },
    { id: 'ready', label: 'Ready', value: String(summary.ready), description: '服务端 summary DTO 当前为 READY。', tone: 'ready' },
    { id: 'repairable', label: 'Warning', value: String(summary.warning), description: '服务端 summary DTO 当前为 WARNING；前端只展示，不重算。', tone: 'review' },
    { id: 'blocked', label: 'Blocked', value: String(summary.blocked), description: '服务端 summary DTO 当前为 BLOCKED。', tone: 'blocked' },
  ]
}

function riskSummariesFromSummary(summary: BackendHealthSummary) {
  return [
    { id: 'warning', label: 'WARNING SKU', count: summary.warning, description: '服务端已判定需要修复或复核的 SKU。', targetHref: '/sku-access', tone: 'warning' as const },
    { id: 'blocked', label: 'BLOCKED SKU', count: summary.blocked, description: '服务端已判定阻断的 SKU，需先补齐证据或库存。', targetHref: '/sku-access', tone: 'blocked' as const },
  ]
}

function recentRunsFromSummary(summary: BackendHealthSummary): RecentWorkflowRunDto[] {
  return [
    {
      id: 'health-summary-current',
      title: 'Health summary query',
      source: 'GET /api/health/summary',
      status: 'SUCCEEDED',
      finishedAtLabel: '当前请求',
      targetHref: '/sku-access',
      summary: `当前真实 summary 覆盖 ${summary.total} 个 SKU；READY ${summary.ready}、WARNING ${summary.warning}、BLOCKED ${summary.blocked}。`,
    },
  ]
}

function connectorApiRows(
  summaryResult: ApiResult<BackendHealthSummary>,
  skuListResult: ApiResult<PageDto<BackendSkuSummary>>,
): ConnectorDto[] {
  return [
    {
      id: 'health-summary-api',
      name: 'Health Summary API',
      platform: 'PickAgent API',
      status: summaryResult.ok ? 'CONNECTED' : 'DEGRADED',
      lastIngestedAtLabel: summaryResult.ok ? `request ${summaryResult.requestId}` : '不可用',
      lastIngestSummary: summaryResult.ok
        ? `GET ${STAFF_HEALTH_ENDPOINTS.summary} 返回 total=${summaryResult.data.total}, ready=${summaryResult.data.ready}, warning=${summaryResult.data.warning}, blocked=${summaryResult.data.blocked}`
        : summaryResult.reason,
      capabilityBoundary: '只展示健康汇总 DTO，不在页面重算任何健康状态。',
      targetHref: '/overview',
    },
    {
      id: 'sku-list-api',
      name: 'SKU List API',
      platform: 'PickAgent API',
      status: skuListResult.ok ? 'CONNECTED' : 'DEGRADED',
      lastIngestedAtLabel: skuListResult.ok ? `request ${skuListResult.requestId}` : '不可用',
      lastIngestSummary: skuListResult.ok ? `GET ${STAFF_HEALTH_ENDPOINTS.skuList} 返回 ${skuListResult.data.items.length}/${skuListResult.data.total} 条 SKU。` : skuListResult.reason,
      capabilityBoundary: '只展示 CurrentSkuProjection/SkuSummary DTO，不拼 snapshot 与 diagnosis。',
      targetHref: '/sku-access',
    },
  ]
}

function toProjection(summary: BackendSkuSummary): CurrentSkuProjectionDto {
  return {
    skuProfileId: summary.skuProfileId,
    canonicalSkuKey: summary.canonicalSkuKey,
    productName: summary.productName,
    platform: summary.platform,
    storeName: summary.storeId,
    healthStatus: toUiHealthStatus(summary.healthStatus),
    healthScore: summary.healthScore,
    dataQualityScore: summary.dataQualityScore,
    issueSummary: summary.topIssues.length > 0 ? summary.topIssues.join('；') : '服务端 DTO 未返回问题摘要。',
    nextAction: summary.nextActions.length > 0 ? summary.nextActions.join('；') : '服务端 DTO 未返回下一步动作。',
    updatedAtLabel: '来自 GET /api/skus',
    targetHref: `/sku-health/${summary.skuProfileId}`,
  }
}

function toSkuDetail(detail: BackendSkuDetail): SkuDetailDto {
  const projection = { ...toProjection(detail), updatedAtLabel: formatDateLabel(detail.latestDiagnosis?.diagnosedAt ?? detail.latestSnapshot?.collectedAt) }
  const collectionRisks = collectionRiskIssues(detail)
  const diagnosisIssues = detail.latestDiagnosis?.issues ?? detail.topIssues

  return {
    projection,
    issues: [
      ...diagnosisIssues.map((issue, index) => ({ id: `diagnosis-issue-${index}`, severity: issueTone(projection.healthStatus), title: issue, summary: issue })),
      ...collectionRisks,
    ],
    evidence: toEvidence(detail),
    nextActions: (detail.latestDiagnosis?.nextActions ?? detail.nextActions).map((action, index) => ({ id: `action-${index}`, title: action, description: action, owner: '服务端 DTO' })),
    traceability: {
      snapshot: detail.latestSnapshot
        ? {
            id: detail.latestSnapshot.snapshotId,
            collectedAtLabel: formatDateLabel(detail.latestSnapshot.collectedAt),
            summary: `库存 ${valueOrMissing(detail.latestSnapshot.stock)}，价格字段 ${hasAnyPrice(detail.latestSnapshot) ? '已返回' : '缺失'}，类目 ${detail.latestSnapshot.category ?? '缺失'}。`,
          }
        : null,
      diagnosis: detail.latestDiagnosis
        ? {
            id: detail.latestDiagnosis.diagnosisId,
            diagnosedAtLabel: formatDateLabel(detail.latestDiagnosis.diagnosedAt),
            summary: `服务端诊断状态 ${detail.latestDiagnosis.healthStatus}，健康分 ${detail.latestDiagnosis.healthScore}，数据质量 ${detail.latestDiagnosis.dataQualityScore}。`,
          }
        : null,
      collectionRisks: collectionRisks.map((risk) => risk.summary),
      evidenceSources: detail.evidence.map((item) => `${item.label}: ${item.summary}`),
    },
  }
}

function detailFromProjection(projection: CurrentSkuProjectionDto, viewState: ApiViewState): SkuDetailDto {
  return {
    projection,
    issues: [{ id: 'projection-issue-summary', severity: issueTone(projection.healthStatus), title: 'Projection 问题摘要', summary: projection.issueSummary }],
    evidence: [{ id: 'projection', label: 'CurrentSkuProjection', value: projection.skuProfileId, source: 'GET /api/skus 成功，但 detail 查询不可用时的显式 fallback。' }],
    nextActions: [{ id: 'projection-next-action', title: projection.nextAction, description: projection.nextAction, owner: '服务端 projection' }],
    traceability: {
      snapshot: null,
      diagnosis: null,
      collectionRisks: ['detail API 不可用，不能展示 snapshot / diagnosis。'],
      evidenceSources: ['CurrentSkuProjection fallback'],
    },
    viewState,
  }
}

function collectionRiskIssues(detail: BackendSkuDetail): SkuIssueDto[] {
  const risks: SkuIssueDto[] = []
  if (!hasAnyPrice(detail.latestSnapshot)) {
    risks.push({ id: 'collection-price-gap', severity: 'review', title: '价格采集缺口', summary: '真实 detail DTO 未返回 originalPrice / lowestPrice30d / campaignPrice，按 collection risk 展示。' })
  }
  if (!detail.latestSnapshot?.category) {
    risks.push({ id: 'collection-category-gap', severity: 'review', title: '类目名称采集缺口', summary: '真实 detail DTO 未返回 category，按 collection risk 展示。' })
  }
  return risks
}

function toEvidence(detail: BackendSkuDetail): SkuEvidenceDto[] {
  const snapshot = detail.latestSnapshot
  return [
    ...detail.evidence.map((item) => ({ id: `${item.type}-${item.entityId}`, label: item.label, value: item.entityId, source: item.summary })),
    { id: 'snapshot-id', label: 'snapshotId', value: snapshot?.snapshotId ?? '缺失', source: 'latestSnapshot DTO' },
    { id: 'stock', label: '可售库存', value: valueOrMissing(snapshot?.stock), source: 'latestSnapshot DTO' },
    { id: 'price', label: '价格字段', value: hasAnyPrice(snapshot) ? '已返回' : '缺失', source: 'latestSnapshot DTO' },
    { id: 'diagnosis-id', label: 'diagnosisId', value: detail.latestDiagnosis?.diagnosisId ?? '缺失', source: 'latestDiagnosis DTO' },
  ]
}

function toUiHealthStatus(status: BackendHealthStatus): HealthStatus {
  if (status === 'READY') return 'READY'
  if (status === 'WARNING') return 'REPAIRABLE'
  if (status === 'BLOCKED') return 'BLOCKED'
  return 'RISKY'
}

function issueTone(status: HealthStatus): StatusTone {
  if (status === 'BLOCKED') return 'blocked'
  if (status === 'RISKY') return 'warning'
  return 'review'
}

function hasAnyPrice(snapshot: BackendSkuDetail['latestSnapshot']): boolean {
  return snapshot?.originalPrice !== undefined || snapshot?.lowestPrice30d !== undefined || snapshot?.campaignPrice !== undefined
}

function valueOrMissing(value: number | string | boolean | undefined): string {
  return value === undefined ? '缺失' : String(value)
}

function formatDateLabel(value?: string | null): string {
  if (!value) return '未返回'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function realState(endpoint: string, requestId?: string): ApiViewState {
  return { kind: 'real', endpoint, requestId, message: '正在消费真实 API DTO。' }
}

function emptyState(endpoint: string, requestId: string | undefined, message: string): ApiViewState {
  return { kind: 'empty', endpoint, requestId, message }
}

function fallbackState(endpoint: string, reason: string): ApiViewState {
  return { kind: 'fallback', endpoint, message: `真实 API 不可用，当前不展示替代业务数据：${reason}` }
}
