import { finalAgentRuntime, finalApiRuntime } from '../_final-api-runtime'

import type { P0AuthContextDto } from '../../../../../backend/src/application/foundation/P0AuthBoundaryRuntimeConfig'

export interface RunConsoleItemDto {
  runId: string
  type: string
  status: string
  subject: string
  sourceId?: string
  sourceHref?: string
  startedAt?: string
  completedAt?: string
  summary: string
  logs: Array<{ time?: string; tag: string; message: string; payload?: unknown }>
}

export interface RunConsolePageDto {
  items: RunConsoleItemDto[]
  total: number
  page: number
  pageSize: number
}

export interface RunConsoleLogExportDto {
  runId: string
  fileName: string
  contentType: 'text/plain'
  content: string
  lineCount: number
}

export async function buildRunConsolePage(boundary: P0AuthContextDto, limit = 50): Promise<RunConsolePageDto> {
  const runs: RunConsoleItemDto[] = []

  const connectors = await finalApiRuntime.connectorService.list(1, 20, boundary)
  for (const connector of connectors.items) {
    const connectorRuns = await finalApiRuntime.connectorService.listRuns(connector.connectorId, 1, 5, boundary)
    runs.push(...connectorRuns.items.map((run) => ({
      runId: run.connectorRunId,
      type: 'connector_sync',
      status: run.status,
      subject: connector.name,
      sourceId: connector.connectorId,
      sourceHref: entityHref('connector', connector.connectorId),
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      summary: `采集 ${run.rowCount} 行，质量分 ${run.qualityScore ?? '-'}`,
      logs: [
        { time: run.startedAt, tag: 'Connector', message: `开始采集：${connector.name}` },
        { time: run.completedAt, tag: 'Data', message: `采集完成：${run.rowCount} 行，质量分 ${run.qualityScore ?? '-'}`, payload: { warnings: run.warnings } },
      ],
    })))
  }

  const missions = finalAgentRuntime.agentService.listMissions({ page: 1, pageSize: 20 })
  for (const mission of missions.items) {
    const detail = finalAgentRuntime.agentService.getMission(mission.missionId)
    runs.push(...detail.runs.map((run) => ({
      runId: run.runId,
      type: 'agent_run',
      status: run.status,
      subject: mission.objective,
      sourceId: mission.missionId,
      sourceHref: entityHref('agent_mission', mission.missionId, run.runId),
      startedAt: run.startedAt ?? undefined,
      completedAt: run.completedAt ?? undefined,
      summary: `Agent Mission：${mission.objective}`,
      logs: finalAgentRuntime.agentService.listEvents(run.runId).map((event) => ({
        time: event.createdAt,
        tag: 'Agent',
        message: `${event.eventType} / ${event.eventPhase}`,
        payload: event.payloadJson,
      })),
    })))
  }

  const simulationRuns = await finalApiRuntime.activityService.listRecentSimulationRuns(boundary, 20)
  runs.push(...simulationRuns.map((run) => ({
    runId: run.simulationRunId,
    type: 'activity_simulation',
    status: run.status,
    subject: `规则集 ${run.activityRuleSetId.slice(0, 8)}`,
    sourceId: run.activityRuleSetId,
    sourceHref: entityHref('activity_simulation', run.activityRuleSetId, run.simulationRunId),
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    summary: `准入模拟 ${run.results.length} 个 SKU，阻断 ${run.results.filter((result) => result.eligibility === 'BLOCKED').length} 个，需人工确认 ${run.results.filter((result) => result.eligibility === 'MANUAL_REVIEW').length} 个`,
    logs: [
      { time: run.startedAt, tag: 'Simulation', message: `开始活动准入模拟：${run.activityRuleSetId}`, payload: run.scope },
      { time: run.completedAt, tag: 'Simulation', message: `模拟完成：${run.results.length} 个 SKU`, payload: { results: run.results.map((result) => ({ simulationResultId: result.simulationResultId, skuProfileId: result.skuProfileId, eligibility: result.eligibility, failedRules: result.failedRules.map((rule) => rule.id) })) } },
    ],
  })))

  const workflowAudits = await finalApiRuntime.workflowAuditService.list(boundary, limit)
  runs.push(...workflowAudits.map((audit) => ({
    runId: audit.workflowRunId,
    type: audit.workflowType,
    status: audit.status,
    subject: `${audit.subjectType ?? 'workflow'}:${audit.subjectId ?? '-'}`,
    sourceId: audit.subjectId,
    sourceHref: audit.subjectType && audit.subjectId ? entityHref(audit.subjectType, audit.subjectId) : undefined,
    startedAt: audit.createdAt,
    completedAt: audit.createdAt,
    summary: `${audit.workflowType} -> ${audit.subjectType ?? 'workflow'}`,
    logs: [
      { time: audit.createdAt, tag: 'Workflow', message: `输入：${JSON.stringify(audit.input).slice(0, 240)}` },
      { time: audit.createdAt, tag: 'Workflow', message: `输出：${JSON.stringify(audit.output).slice(0, 240)}` },
    ],
  })))

  const sorted = runs.sort((left, right) => Date.parse(right.startedAt ?? right.completedAt ?? '') - Date.parse(left.startedAt ?? left.completedAt ?? ''))
  return { items: sorted.slice(0, limit), total: sorted.length, page: 1, pageSize: limit }
}

function entityHref(entityType: string, entityId: string, runId?: string): string | undefined {
  if (entityType === 'connector') return `/data-sources?connectorId=${encodeURIComponent(entityId)}`
  if (entityType === 'agent_mission') {
    const params = new URLSearchParams({ missionId: entityId })
    if (runId) params.set('runId', runId)
    return `/agent-mission?${params.toString()}`
  }
  if (entityType === 'activity_simulation') {
    const params = new URLSearchParams({ ruleSetId: entityId })
    if (runId) params.set('simulationRunId', runId)
    return `/rule-execution?${params.toString()}`
  }
  if (entityType === 'rule_set') return `/rule-library?ruleSetId=${encodeURIComponent(entityId)}`
  if (entityType === 'report') return `/report-center?reportId=${encodeURIComponent(entityId)}`
  if (entityType === 'review_item') return `/review-approvals?reviewItemId=${encodeURIComponent(entityId)}`
  if (entityType === 'activity') return `/rule-execution?activityId=${encodeURIComponent(entityId)}`
  if (entityType === 'sku_profile') return `/sku-access?skuProfileId=${encodeURIComponent(entityId)}`
  return undefined
}

export async function buildRunConsoleLogExport(boundary: P0AuthContextDto, runId: string): Promise<RunConsoleLogExportDto | null> {
  const page = await buildRunConsolePage(boundary, 100)
  const run = page.items.find((item) => item.runId === runId)
  if (!run) return null
  const lines = [
    `Run ${run.runId}`,
    `Type: ${run.type}`,
    `Status: ${run.status}`,
    `Subject: ${run.subject}`,
    '',
    ...run.logs.map((log) => `[${formatRunLogTime(log.time)}] [${log.tag}] ${log.message}${log.payload ? ` ${JSON.stringify(log.payload)}` : ''}`),
  ]
  return {
    runId: run.runId,
    fileName: `run-${run.runId}.log`,
    contentType: 'text/plain',
    content: lines.join('\n'),
    lineCount: lines.length,
  }
}

function formatRunLogTime(value?: string): string {
  if (!value) return '--:--:--'
  return new Date(value).toISOString()
}
