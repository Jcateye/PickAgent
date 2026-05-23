import { createBusinessFoundationRuntime } from '../../../../backend/src/application/foundation/BusinessFoundationServices'
import type { ReviewDecision as ServiceReviewDecision, ReviewItemDto as ServiceReviewItemDto } from '../../../../contracts/types/businessFoundation'

import type { ReviewDecision, ReviewItemDto, ReviewRiskLevel, ReviewSourceType, ReviewStatus } from './review-contracts'
import { mockReviewItems } from './review-fixtures'

export interface ReviewProviderSnapshot {
  items: ReviewItemDto[]
  decide: (reviewId: string, decision: ReviewDecision, decisionBy: string, comment?: string) => ReviewItemDto
  mode: 'service' | 'mock_fallback'
  fallbackReason?: string
}

export function createReviewProviderSnapshot(): ReviewProviderSnapshot {
  try {
    const runtime = createBusinessFoundationRuntime()
    const seeded = seedReviewService(runtime)
    const items = seeded.map(mapServiceReviewItem)

    return {
      items,
      mode: 'service',
      decide: (reviewId, decision, decisionBy, comment) =>
        mapServiceReviewItem(runtime.reviewService.decide(reviewId, toServiceDecision(decision), decisionBy, comment))
    }
  } catch (error) {
    return {
      items: mockReviewItems,
      mode: 'mock_fallback',
      fallbackReason: error instanceof Error ? error.message : 'ReviewService provider failed',
      decide: (reviewId, decision, decisionBy, comment) => {
        const current = mockReviewItems.find((item) => item.id === reviewId) ?? mockReviewItems[0]
        return {
          ...current,
          status: decisionToStatus(decision),
          decisionComment: comment,
          decidedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
          updatedAt: new Date().toLocaleString('zh-CN', { hour12: false })
        }
      }
    }
  }
}

function seedReviewService(runtime: ReturnType<typeof createBusinessFoundationRuntime>): ServiceReviewItemDto[] {
  const collectedAt = new Date('2026-05-23T10:00:00.000Z').toISOString()
  const ingest = runtime.ingestService.ingest({
    collectedAt,
    rows: [
      {
        platform: 'douyin',
        storeId: 'demo-store',
        externalSkuId: 'SKU-AU-18K-042',
        productName: '18K 金项链 / 经典链长',
        stock: 8,
        positiveRate: 0.96,
        certificateStatus: 'valid',
        raw: { fixture: 'layer3-review-reporting', source: 'ReviewService seed' }
      },
      {
        platform: 'douyin',
        storeId: 'demo-store',
        externalSkuId: 'SKU-DIA-PT950-017',
        productName: 'PT950 钻戒 / 主石 30 分',
        stock: 32,
        positiveRate: 0.9,
        certificateStatus: 'missing',
        raw: { fixture: 'layer3-review-reporting', source: 'ReviewService seed' }
      }
    ]
  })
  const ruleSet = runtime.activityRuleService.parseRules({
    name: '618 活动准入规则',
    platform: 'douyin',
    sourceText: '库存不少于 20，好评率不少于 92%，证书必须有效，manual check for stock commitment'
  })
  const simulations = runtime.activitySimulationService.runSimulation({
    ruleSetId: ruleSet.ruleSetId,
    skuProfileIds: ingest.summaries.map((item) => item.skuProfileId)
  })

  return runtime.reviewService.createReviewItems([
    {
      skuProfileId: ingest.summaries[0]?.skuProfileId,
      sourceType: 'simulation',
      sourceId: simulations[0]?.simulationResultId ?? ruleSet.ruleSetId,
      question: '是否允许库存不足 SKU 在补齐承诺后进入活动报名清单？',
      recommendation: '建议要求供应链确认补货时间，再要求修改后复核。',
      riskLevel: 'L2',
      evidence: simulations[0]?.evidence ?? []
    },
    {
      skuProfileId: ingest.summaries[1]?.skuProfileId,
      sourceType: 'health',
      sourceId: ingest.diagnoses[1]?.diagnosisId ?? ingest.summaries[1]?.skuProfileId ?? 'health-seed',
      question: '证书与好评率风险是否允许进入修复队列？',
      recommendation: '建议先补齐证书并定位好评率问题，不直接批准报名。',
      riskLevel: 'L2',
      evidence: ingest.diagnoses[1]?.evidence ?? []
    }
  ])
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
      routeLabel: sourceRouteLabel(item.sourceType)
    },
    question: item.question,
    recommendation: item.recommendation ?? '等待人工确认后推进。',
    riskLevel: mapRiskLevel(item.riskLevel),
    riskSummary: item.riskLevel === 'L2' ? '该项仍存在未解决风险，需要保留人工 Review 证据链。' : '低风险决策，仍需保留来源对象追溯。',
    evidenceSummary: item.evidence.map((evidence) => ({
      id: `${evidence.type}:${evidence.entityId}`,
      label: evidence.label,
      value: evidence.summary,
      source: evidence.type
    })),
    createdAt: item.decidedAt ?? '2026-05-23 10:00',
    updatedAt: item.decidedAt ?? '2026-05-23 10:00',
    decisionComment: item.decisionComment,
    decidedAt: item.decidedAt
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

function decisionToStatus(decision: ReviewDecision): ReviewStatus {
  if (decision === 'approve') return 'approved'
  if (decision === 'reject') return 'rejected'
  return 'changes_requested'
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
