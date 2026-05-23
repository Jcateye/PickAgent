import type {
  ApiEnvelope,
  PageDto,
  ReviewDecisionRequestDto
} from '../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import type {
  EvidenceLinkDto,
  ReviewDecision as ServiceReviewDecision,
  ReviewItemDto as ServiceReviewItemDto
} from '../../../../contracts/types/businessFoundation'

import type { ReviewDecision, ReviewItemDto, ReviewRiskLevel, ReviewSourceType, ReviewStatus } from './review-contracts'

export async function fetchReviewItems(): Promise<ReviewItemDto[]> {
  const response = await fetch('/api/reviews', { cache: 'no-store' })
  const envelope = (await response.json()) as ApiEnvelope<PageDto<ServiceReviewItemDto>>
  if (!response.ok || envelope.code !== 'OK' || !envelope.data) {
    throw new Error(envelope.message || 'Review API failed')
  }
  return envelope.data.items.map(mapServiceReviewItem)
}

export async function decideReviewItem(reviewId: string, decision: ReviewDecision, decisionBy: string, comment?: string): Promise<ReviewItemDto> {
  const payload: ReviewDecisionRequestDto = {
    decision: toServiceDecision(decision),
    decisionBy,
    decisionComment: comment
  }
  const response = await fetch(`/api/reviews/${reviewId}/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const envelope = (await response.json()) as ApiEnvelope<ServiceReviewItemDto>
  if (!response.ok || envelope.code !== 'OK' || !envelope.data) {
    throw new Error(envelope.message || 'Review decision API failed')
  }
  return mapServiceReviewItem(envelope.data)
}

function mapServiceReviewItem(item: ServiceReviewItemDto): ReviewItemDto {
  return {
    id: item.reviewItemId,
    targetLabel: item.skuProfileId ?? item.sourceId,
    status: mapStatus(item.status),
    source: {
      id: item.sourceId,
      type: mapSourceType(item.sourceType),
      title: sourceTitle(item.sourceType),
      routeLabel: sourceRouteLabel(item.sourceType),
      href: sourceHref(item.sourceType)
    },
    question: item.question,
    recommendation: item.recommendation ?? '等待人工确认后推进。',
    riskLevel: mapRiskLevel(item.riskLevel),
    riskSummary: item.riskLevel === 'L2' ? '该项仍存在未解决风险，需要保留人工 Review 证据链。' : '低风险决策，仍需保留来源对象追溯。',
    evidenceSummary: item.evidence.map(mapEvidence),
    createdAt: item.decidedAt ?? '持久化 Review API',
    updatedAt: item.decidedAt ?? '持久化 Review API',
    decisionComment: item.decisionComment,
    decidedAt: item.decidedAt
  }
}

function mapEvidence(evidence: EvidenceLinkDto) {
  return {
    id: `${evidence.type}:${evidence.entityId}`,
    label: evidence.label,
    value: evidence.summary,
    source: evidence.type,
    href: evidenceHref(evidence.type, evidence.entityId)
  }
}

function mapStatus(status: ServiceReviewItemDto['status']): ReviewStatus {
  if (status === 'APPROVED') return 'approved'
  if (status === 'REJECTED') return 'rejected'
  if (status === 'CHANGES_REQUESTED') return 'changes_requested'
  return 'pending'
}

function mapSourceType(sourceType: ServiceReviewItemDto['sourceType']): ReviewSourceType {
  if (sourceType === 'health') return 'health_diagnosis'
  if (sourceType === 'agent') return 'agent_gate'
  return 'activity_simulation'
}

function mapRiskLevel(riskLevel: ServiceReviewItemDto['riskLevel']): ReviewRiskLevel {
  if (riskLevel === 'L0') return 'low'
  if (riskLevel === 'L1') return 'medium'
  return 'high'
}

function toServiceDecision(decision: ReviewDecision): ServiceReviewDecision {
  if (decision === 'approve') return 'APPROVE'
  if (decision === 'reject') return 'REJECT'
  return 'REQUEST_CHANGES'
}

function sourceTitle(sourceType: ServiceReviewItemDto['sourceType']) {
  if (sourceType === 'health') return 'SKU 健康诊断'
  if (sourceType === 'agent') return 'Agent Review Gate'
  return '活动准入模拟'
}

function sourceRouteLabel(sourceType: ServiceReviewItemDto['sourceType']) {
  if (sourceType === 'health') return '查看健康档案'
  if (sourceType === 'agent') return '查看 Review Gate'
  return '查看模拟结果'
}

function sourceHref(sourceType: ServiceReviewItemDto['sourceType']) {
  if (sourceType === 'health') return '/sku-health'
  if (sourceType === 'agent') return '/agent-chat'
  return '/activities'
}

function evidenceHref(type: EvidenceLinkDto['type'], entityId: string) {
  const encodedId = encodeURIComponent(entityId)
  if (type === 'snapshot' || type === 'diagnosis') return `/sku-health?evidence=${encodedId}`
  if (type === 'rule' || type === 'simulation') return `/activities?evidence=${encodedId}`
  if (type === 'review') return `/reviews?evidence=${encodedId}`
  if (type === 'tool_trace') return `/agent-chat?evidence=${encodedId}`
  return `/workflows?evidence=${encodedId}`
}
