import { authContextFromRequest, finalAgentRuntime, finalApiRuntime, ok } from '../_final-api-runtime'

interface RunConsoleItemDto {
  runId: string
  type: string
  status: string
  subject: string
  startedAt?: string
  completedAt?: string
  summary: string
  logs: Array<{ time?: string; tag: string; message: string; payload?: unknown }>
}

export async function GET(request: Request) {
  const boundary = authContextFromRequest(request)
  const runs: RunConsoleItemDto[] = []

  const connectors = await finalApiRuntime.connectorService.list(1, 20, boundary)
  for (const connector of connectors.items) {
    const connectorRuns = await finalApiRuntime.connectorService.listRuns(connector.connectorId, 1, 5, boundary)
    runs.push(...connectorRuns.items.map((run) => ({
      runId: run.connectorRunId,
      type: 'connector_sync',
      status: run.status,
      subject: connector.name,
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

  if (finalApiRuntime.adapter === 'memory') {
    runs.push(...Array.from(finalApiRuntime.store.workflowAudits.values()).map((audit) => ({
      runId: audit.workflowRunId,
      type: audit.workflowType,
      status: audit.status,
      subject: `${audit.subjectType}:${audit.subjectId ?? '-'}`,
      startedAt: audit.createdAt,
      completedAt: audit.createdAt,
      summary: `${audit.workflowType} -> ${audit.subjectType}`,
      logs: [
        { time: audit.createdAt, tag: 'Workflow', message: `输入：${JSON.stringify(audit.input).slice(0, 240)}` },
        { time: audit.createdAt, tag: 'Workflow', message: `输出：${JSON.stringify(audit.output).slice(0, 240)}` },
      ],
    })))
  }

  const sorted = runs.sort((left, right) => Date.parse(right.startedAt ?? right.completedAt ?? '') - Date.parse(left.startedAt ?? left.completedAt ?? ''))
  return ok({ items: sorted.slice(0, 50), total: sorted.length, page: 1, pageSize: 50 })
}
