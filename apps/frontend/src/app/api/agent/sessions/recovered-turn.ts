export function toRecoveredTurn(contentJson: Record<string, unknown>, runId: string | null) {
  const toolExecutions = Array.isArray(contentJson.toolExecutions) ? contentJson.toolExecutions : []
  if (!toolExecutions.length) return undefined
  const reviewGate = recoverReviewGate(toolExecutions, runId)
  const evidenceRefs = recoverEvidenceRefs(toolExecutions)
  const linkedEntities = recoverLinkedEntities(toolExecutions)
  return {
    runId: runId ?? '',
    fallbackUsed: false,
    thoughts: ['从历史消息恢复工具链摘要。'],
    toolTrace: toolExecutions.map((item) => {
      const value = item as Record<string, unknown>
      const toolCallId = String(value.toolCallId ?? value.toolName ?? 'tool')
      return {
        id: toolCallId,
        toolName: String(value.toolName ?? 'tool'),
        status: value.status === 'FAILED' ? 'failed' : value.status === 'WAITING_FOR_APPROVAL' ? 'waiting_for_approval' : 'succeeded',
        riskLevel: value.riskLevel === 'L2' || value.riskLevel === 'L0' ? value.riskLevel : 'L1',
        reviewPolicy: value.reviewGateId || value.reviewPolicy === 'REVIEW_GATE' ? 'review_gate' : 'none',
        inputSummary: '',
        outputSummary: String(value.summary ?? ''),
        evidenceRefs: Array.isArray(value.evidenceRefIds) ? value.evidenceRefIds.map(String) : [],
      }
    }),
    evidenceRefs,
    linkedEntities,
    reviewGate,
  }
}

function recoverReviewGate(toolExecutions: unknown[], runId: string | null) {
  const gated = toolExecutions
    .map((item) => item as Record<string, unknown>)
    .find((item) => typeof item.reviewGateId === 'string' && item.reviewGateId)
  if (!gated) return null
  const toolName = String(gated.toolName ?? 'tool')
  return {
    id: String(gated.reviewGateId),
    status: 'PENDING',
    reasonCode: String(gated.reviewPolicy ?? 'chat_write_tool_requires_review'),
    question: `是否允许 Agent 执行 ${toolName}？`,
    agentRecommendation: String(gated.summary ?? '该工具需要人工确认后继续。'),
    riskIfApproved: '批准后，Agent 可继续执行该写入类工具并改变系统状态。',
    riskIfRejected: '拒绝后，本次对话只保留建议和证据，不会执行该写入类工具。',
    evidenceRefs: Array.isArray(gated.evidenceRefIds) ? gated.evidenceRefIds.map(String) : [],
    runTraceHref: runId ? `/agent-mission?runId=${encodeURIComponent(runId)}` : undefined,
  }
}

function recoverEvidenceRefs(toolExecutions: unknown[]) {
  const refs = toolExecutions.flatMap((item) => {
    const value = item as Record<string, unknown>
    return Array.isArray(value.evidenceRefs) ? value.evidenceRefs : []
  })
  return uniqueById(refs.map((item, index) => {
    const value = item as Record<string, unknown>
    const evidenceType = String(value.evidenceType ?? 'tool_result')
    return {
      id: String(value.id ?? `recovered-evidence-${index}`),
      evidenceType: evidenceType === 'snapshot' || evidenceType === 'rule' || evidenceType === 'simulation' || evidenceType === 'review_gate' ? evidenceType : 'tool_result',
      label: String(value.label ?? '历史证据'),
      summary: String(value.summary ?? ''),
      entityType: typeof value.entityType === 'string' ? value.entityType : undefined,
      entityId: typeof value.entityId === 'string' ? value.entityId : undefined,
    }
  }))
}

function recoverLinkedEntities(toolExecutions: unknown[]) {
  const entities = toolExecutions.flatMap((item) => {
    const value = item as Record<string, unknown>
    return Array.isArray(value.linkedEntities) ? value.linkedEntities : []
  })
  return uniqueById(entities.map((item, index) => {
    const value = item as Record<string, unknown>
    return {
      id: String(value.id ?? `recovered-entity-${index}`),
      entityType: String(value.entityType ?? 'dashboard'),
      entityId: String(value.entityId ?? ''),
      label: String(value.label ?? value.entityId ?? '历史实体'),
      reason: String(value.reason ?? '从历史工具调用恢复'),
      sourceType: recoveredSourceType(value.sourceType),
      sourceId: String(value.sourceId ?? 'recovered-tool-call'),
      href: typeof value.href === 'string' ? value.href : recoveredLinkedEntityHref(String(value.entityType ?? 'dashboard'), String(value.entityId ?? '')),
    }
  }).filter((item) => item.entityId))
}

function recoveredSourceType(value: unknown) {
  return value === 'mission' || value === 'run' || value === 'message' || value === 'review_gate' ? value : 'tool_call'
}

function recoveredLinkedEntityHref(entityType: string, entityId: string): string {
  if (entityType === 'sku_profile') return `/sku-access?${new URLSearchParams({ skuProfileId: entityId, drawerTab: 'evidence' }).toString()}`
  if (entityType === 'activity') return `/rule-execution?${new URLSearchParams({ activityId: entityId }).toString()}`
  if (entityType === 'rule_set' || entityType === 'activity_rule_set') return `/rule-library?${new URLSearchParams({ ruleSetId: entityId }).toString()}`
  if (entityType === 'simulation_run') {
    const [ruleSetId, simulationRunId] = entityId.includes(':') ? entityId.split(':', 2) : ['', entityId]
    const params = new URLSearchParams({ simulationRunId: decodeURIComponent(simulationRunId) })
    if (ruleSetId) params.set('ruleSetId', decodeURIComponent(ruleSetId))
    return `/rule-execution?${params.toString()}`
  }
  if (entityType === 'review_item') return `/review-approvals?${new URLSearchParams({ reviewItemId: entityId }).toString()}`
  if (entityType === 'report') return `/report-center?${new URLSearchParams({ reportId: entityId }).toString()}`
  if (entityType === 'workflow_run') return `/run-console?${new URLSearchParams({ runId: entityId }).toString()}`
  if (entityType === 'connector') return `/data-sources?${new URLSearchParams({ connectorId: entityId }).toString()}`
  if (entityType === 'agent_mission') return `/agent-mission?${new URLSearchParams({ missionId: entityId }).toString()}`
  if (entityType === 'download_artifact') return entityId.startsWith('/api/') ? entityId : '/overview'
  if (entityId === 'connectors' || entityId === 'browser-scan-ingest') return '/data-sources'
  if (entityId === 'reports') return '/report-center'
  if (entityId === 'reviews') return '/review-approvals'
  if (entityId === 'rule-sets') return '/rule-library'
  if (entityId === 'run-console') return '/run-console'
  if (entityId === 'agent-missions') return '/agent-mission'
  if (entityId === 'settings' || entityId === 'tool-policy' || entityId === 'settings-users') return '/settings'
  return '/overview'
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
