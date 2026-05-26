import { authContextFromRequest, authFail, fail, finalAgentRuntime, finalApiRuntime, ok } from '../../../_final-api-runtime'
import { P0AuthBoundaryError } from '../../../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'
import { buildRunConsolePage, runConsoleRetryDisabledReason, type RunConsoleItemDto } from '../../run-console-data'
import type { DashboardSkuListItemDto } from '../../../../../../../contracts/types/dashboardSkuReadModels'

interface RouteContext {
  params: Promise<{ runId: string }>
}

interface RetryRunResultDto {
  runId: string
  type: string
  sourceHref?: string
  result: unknown
}

export async function POST(request: Request, context: RouteContext) {
  const { runId } = await context.params
  const requestId = request.headers.get('x-request-id') ?? undefined
  try {
    const boundary = authContextFromRequest(request)
    const page = await buildRunConsolePage(boundary, 200)
    const run = page.items.find((item) => item.runId === runId)
    if (!run) return fail('RUN.NOT_FOUND', `Run not found: ${runId}`, 404, { runId }, requestId)
    const retryDisabledReason = runConsoleRetryDisabledReason(run)
    if (retryDisabledReason) return fail('RUN.NOT_RETRYABLE', retryDisabledReason, 409, { runId, status: run.status, type: run.type }, requestId)
    return ok(await retryRun(run, boundary), requestId)
  } catch (error) {
    if (error instanceof P0AuthBoundaryError) return authFail(error)
    return fail('RUN.RETRY_FAILED', error instanceof Error ? error.message : 'Retry run failed', 400, { runId }, requestId)
  }
}

async function retryRun(run: RunConsoleItemDto, boundary: ReturnType<typeof authContextFromRequest>): Promise<RetryRunResultDto> {
  const input = firstPayload(run)
  if (run.type === 'connector_sync') {
    const sourceId = requireSourceId(run)
    const result = await finalApiRuntime.connectorService.createSyncRun(sourceId, {
      rowCount: 0,
      qualityScore: 0,
      warnings: ['从运行控制台重试失败运行'],
      summary: { retryOf: run.runId, triggeredBy: 'run-console' },
    }, boundary)
    return { runId: result.workflowRunRef?.entityId ?? result.connectorRunId, type: run.type, sourceHref: `/run-console?runId=${encodeURIComponent(result.workflowRunRef?.entityId ?? result.connectorRunId)}`, result }
  }
  if (run.type === 'agent_run') {
    const sourceId = requireSourceId(run)
    const result = finalAgentRuntime.agentService.startRun(sourceId, {
      modelProvider: 'pi',
      modelName: 'sku-ready-agent',
      inputJson: { retryOf: run.runId, triggeredBy: 'run-console' },
    })
    return { runId: result.id, type: run.type, sourceHref: `/run-console?runId=${encodeURIComponent(result.id)}`, result }
  }
  if (run.type === 'activity_simulation') {
    const sourceId = requireSourceId(run)
    const skuProfileIds = simulationSkuProfileIds(run)
    if (!skuProfileIds.length) throw new Error('当前模拟运行没有可复用的 SKU 范围')
    const result = await finalApiRuntime.activityService.simulate(sourceId, { skuProfileIds }, boundary)
    return { runId: result.workflowRunId ?? result.simulationRunId, type: run.type, sourceHref: `/run-console?runId=${encodeURIComponent(result.workflowRunId ?? result.simulationRunId)}`, result }
  }
  if (run.type === 'sku_export') {
    const result = await finalApiRuntime.skuReadinessQueryService.exportList(isRecord(input.query) ? input.query : {}, boundary)
    return { runId: result.workflowRunId ?? run.runId, type: run.type, sourceHref: result.workflowRunId ? `/run-console?runId=${encodeURIComponent(result.workflowRunId)}` : undefined, result }
  }
  if (run.type === 'report_generate') {
    const skuProfileIds = stringArray(input.skuProfileIds)
    const reportType = input.reportType === 'ACTIVITY' ? 'ACTIVITY' : 'HEALTH'
    if (!skuProfileIds.length) throw new Error('当前报告生成运行没有可复用的 SKU 范围')
    const result = await finalApiRuntime.reportService.generate({ type: reportType, skuProfileIds, simulationResultIds: stringArray(input.simulationResultIds) }, boundary)
    return { runId: result.workflowRunId ?? result.reportId, type: run.type, sourceHref: result.workflowRunId ? `/run-console?runId=${encodeURIComponent(result.workflowRunId)}` : undefined, result }
  }
  if (run.type === 'report_export') {
    const sourceId = requireSourceId(run)
    const request = isRecord(input.request) ? input.request : {}
    const format = request.format === 'EXCEL' || request.format === 'PPT' ? request.format : 'PDF'
    const result = await finalApiRuntime.reportService.export(sourceId, {
      format,
      includeCharts: request.includeCharts !== false,
      includeDetails: request.includeDetails === true,
    }, boundary)
    const retryRunId = result.workflowRunId ?? result.exportJobId
    return { runId: retryRunId, type: run.type, sourceHref: `/run-console?runId=${encodeURIComponent(retryRunId)}`, result }
  }
  if (run.type === 'sku_next_action_update') {
    const sourceId = requireSourceId(run)
    const nextAction = isRecord(input.nextAction) ? input.nextAction : isRecord(run.logs[1]?.payload) && isRecord(run.logs[1]?.payload.nextAction) ? run.logs[1].payload.nextAction : null
    if (!nextAction) throw new Error('当前 SKU 下一步运行没有可复用的 nextAction')
    const result = await finalApiRuntime.skuReadinessQueryService.updateNextAction(sourceId, {
      nextAction: normalizeNextAction(nextAction),
      comment: typeof input.comment === 'string' ? `retryOf:${run.runId}; ${input.comment}` : `retryOf:${run.runId}`,
    }, boundary)
    const retryRunId = result.workflowRunId ?? run.runId
    return { runId: retryRunId, type: run.type, sourceHref: `/run-console?runId=${encodeURIComponent(retryRunId)}`, result }
  }
  if (run.type === 'rule_set_version_create') {
    const sourceId = requireSourceId(run)
    const result = await finalApiRuntime.ruleSetService.createVersion(sourceId, boundary)
    return { runId: result.workflowRunId ?? result.ruleSetVersionId, type: run.type, sourceHref: result.workflowRunId ? `/run-console?runId=${encodeURIComponent(result.workflowRunId)}` : undefined, result }
  }
  if (run.type === 'rule_set_status_update') {
    const sourceId = requireSourceId(run)
    const status = input.status === 'ENABLED' || input.status === 'DRAFT' || input.status === 'DISABLED' ? input.status : undefined
    if (!status) throw new Error('当前规则状态运行没有可复用的目标状态')
    const result = await finalApiRuntime.ruleSetService.setStatus(sourceId, status, boundary)
    return { runId: result.workflowRunId ?? run.runId, type: run.type, sourceHref: result.workflowRunId ? `/run-console?runId=${encodeURIComponent(result.workflowRunId)}` : undefined, result }
  }
  if (run.type === 'activity_candidate_skus') {
    const sourceId = requireSourceId(run)
    const skuProfileIds = stringArray(input.skuProfileIds)
    if (!skuProfileIds.length) throw new Error('当前候选清单运行没有可复用的 SKU 范围')
    const result = await finalApiRuntime.activityService.addCandidateSkus(sourceId, skuProfileIds, {
      reasonCode: 'run-console-retry',
      comment: `retryOf:${run.runId}`,
    }, boundary)
    return { runId: result.workflowRunId ?? run.runId, type: run.type, sourceHref: result.workflowRunId ? `/run-console?runId=${encodeURIComponent(result.workflowRunId)}` : undefined, result }
  }
  throw new Error(`当前 ${run.type} 运行暂不支持自动重试。`)
}

function requireSourceId(run: RunConsoleItemDto): string {
  if (!run.sourceId) throw new Error(`当前 ${run.type} 没有关联源对象，无法自动重试。`)
  return run.sourceId
}

function firstPayload(run: RunConsoleItemDto): Record<string, unknown> {
  const payload = run.logs.find((log) => isRecord(log.payload))?.payload
  return isRecord(payload) ? payload : {}
}

function simulationSkuProfileIds(run: RunConsoleItemDto): string[] {
  const scopePayload = run.logs.find((log) => isRecord(log.payload) && Array.isArray((log.payload as Record<string, unknown>).skuProfileIds))?.payload
  if (isRecord(scopePayload)) return stringArray(scopePayload.skuProfileIds)
  const resultPayload = run.logs.find((log) => isRecord(log.payload) && Array.isArray((log.payload as Record<string, unknown>).results))?.payload
  if (!isRecord(resultPayload) || !Array.isArray(resultPayload.results)) return []
  return resultPayload.results.flatMap((item) => isRecord(item) && typeof item.skuProfileId === 'string' ? [item.skuProfileId] : [])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

function normalizeNextAction(value: Record<string, unknown>): DashboardSkuListItemDto['nextAction'] {
  const rawType = typeof value.type === 'string' && value.type.trim() ? value.type : 'VIEW_DETAIL'
  const type = rawType === 'JOIN_ACTIVITY' || rawType === 'REPAIR_ISSUE' || rawType === 'MANUAL_REVIEW' || rawType === 'VIEW_BLOCKER' || rawType === 'VIEW_DETAIL' ? rawType : 'VIEW_DETAIL'
  const label = typeof value.label === 'string' && value.label.trim() ? value.label : type
  return {
    type,
    label,
    disabled: typeof value.disabled === 'boolean' ? value.disabled : undefined,
  }
}
