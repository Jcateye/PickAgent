'use client'

import { useEffect, useMemo, useState } from 'react'

import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

import type {
  ReviewDecision,
  ReviewItemDto,
  ReviewListFiltersDto,
  ReviewRiskLevel,
  ReviewSourceType,
  ReviewStatus
} from './review-contracts'
import { mockReviewItems } from './review-fixtures'
import { decideReviewItem, fetchReviewItems } from './review-service-provider'

const statusOptions: Array<{ value: ReviewListFiltersDto['status']; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'approved', label: '已批准' },
  { value: 'rejected', label: '已驳回' },
  { value: 'changes_requested', label: '需修改' }
]

const sourceOptions: Array<{ value: ReviewListFiltersDto['sourceType']; label: string }> = [
  { value: 'all', label: '全部来源' },
  { value: 'health_diagnosis', label: '健康诊断' },
  { value: 'activity_simulation', label: '活动模拟' },
  { value: 'agent_gate', label: 'Agent Gate' }
]

const statusLabel: Record<ReviewStatus, string> = {
  pending: '待处理',
  approved: '已批准',
  rejected: '已驳回',
  changes_requested: '需修改'
}

const sourceLabel: Record<ReviewSourceType, string> = {
  health_diagnosis: '健康诊断',
  activity_simulation: '活动模拟',
  agent_gate: 'Agent Gate'
}

const riskLabel: Record<ReviewRiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险'
}

function statusTone(status: ReviewStatus) {
  if (status === 'approved') return 'ready'
  if (status === 'pending') return 'review'
  if (status === 'changes_requested') return 'warning'
  return 'blocked'
}

function riskTone(riskLevel: ReviewRiskLevel) {
  if (riskLevel === 'low') return 'ready'
  if (riskLevel === 'medium') return 'review'
  return 'blocked'
}

function decisionToStatus(decision: ReviewDecision): ReviewStatus {
  if (decision === 'approve') return 'approved'
  if (decision === 'reject') return 'rejected'
  return 'changes_requested'
}

function decisionLabel(decision: ReviewDecision) {
  if (decision === 'approve') return '批准'
  if (decision === 'reject') return '驳回'
  return '要求修改'
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItemDto[]>(mockReviewItems)
  const [filters, setFilters] = useState<ReviewListFiltersDto>({ status: 'all', sourceType: 'all' })
  const [selectedId, setSelectedId] = useState(mockReviewItems[0]?.id)
  const [comment, setComment] = useState('同意按证据摘要推进，保留来源对象追溯。')
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [apiState, setApiState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchReviewItems()
      .then((items) => {
        if (cancelled) return
        setReviews(items)
        setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id)
        setApiState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setApiState('fallback')
        setApiError(error instanceof Error ? error.message : 'Review API failed')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredReviews = useMemo(
    () =>
      reviews.filter((item) => {
        const statusMatched = filters.status === 'all' || item.status === filters.status
        const sourceMatched = filters.sourceType === 'all' || item.source.type === filters.sourceType
        return statusMatched && sourceMatched
      }),
    [filters, reviews]
  )

  const selectedReview = reviews.find((item) => item.id === selectedId) ?? filteredReviews[0] ?? reviews[0]

  async function applyDecision(decision: ReviewDecision) {
    if (!selectedReview) return

    const status = decisionToStatus(decision)
    try {
      const updated = await decideReviewItem(selectedReview.id, decision, 'staff@example.test', comment)
      setReviews((current) =>
        current.map((item) =>
          item.id === selectedReview.id
            ? updated
            : item
        )
      )
      setLastAction(`${selectedReview.id} 已${decisionLabel(decision)}，状态更新为「${statusLabel[status]}」。`)
      setApiError(null)
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Review decision API failed')
    }
  }

  return (
    <div className="pageStack">
      <WorkbenchContextRegistration
        context={{
          route: '/reviews',
          pageTitle: 'Review 工作台',
          selectedEntity: selectedReview
            ? { entityType: 'reviewItem', entityId: selectedReview.id, label: selectedReview.targetLabel }
            : { entityType: 'reviewItem', entityId: 'review-empty', label: 'Review Queue' },
          visibleFilters: { status: filters.status, sourceType: filters.sourceType },
          visibleColumns: ['target', 'status', 'sourceType', 'riskLevel', 'updatedAt'],
        }}
      />
      <PageHeader
        title="Review 工作台"
        description={`默认消费 /api/reviews 与 /api/reviews/:id/decision 的持久化 Review DTO；当前状态：${apiState === 'ready' ? 'API ready' : apiState === 'loading' ? '加载 API snapshot' : 'fixture fallback'}`}
      />

      <div className="reviewWorkbenchLayout">
        <Panel>
          <PanelHeader
            title="Review Queue"
            description="字段 contract：待处理对象、状态、来源类型、风险等级、更新时间和详情入口。"
          />
          <PanelBody>
            <div className="filterBar" aria-label="Review filters">
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ReviewListFiltersDto['status'] }))}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.sourceType}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, sourceType: event.target.value as ReviewListFiltersDto['sourceType'] }))
                }
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="reviewList" role="list">
              {filteredReviews.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`reviewListItem ${item.id === selectedReview?.id ? 'reviewListItem--selected' : ''}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="reviewItemTopline">
                    <strong>{item.targetLabel}</strong>
                    <StatusBadge tone={statusTone(item.status)}>{statusLabel[item.status]}</StatusBadge>
                  </span>
                  <span className="reviewItemMeta">
                    {sourceLabel[item.source.type]} · {riskLabel[item.riskLevel]} · {item.updatedAt}
                  </span>
                  <span className="reviewItemQuestion">{item.question}</span>
                </button>
              ))}
            </div>
          </PanelBody>
        </Panel>

        {selectedReview ? (
          <div className="pageStack">
            <Panel>
              <PanelHeader
                title="Review Detail"
                description={`${selectedReview.id} · ${selectedReview.source.title}`}
                actions={<StatusBadge tone={statusTone(selectedReview.status)}>{statusLabel[selectedReview.status]}</StatusBadge>}
              />
              <PanelBody className="reviewDetailBody">
                <div className="detailBlock">
                  <span>待回答问题</span>
                  <strong>{selectedReview.question}</strong>
                </div>
                <div className="detailBlock">
                  <span>Agent 建议</span>
                  <p>{selectedReview.recommendation}</p>
                </div>
                <div className="detailBlock">
                  <span>风险说明</span>
                  <div className="detailInline">
                    <StatusBadge tone={riskTone(selectedReview.riskLevel)}>{riskLabel[selectedReview.riskLevel]}</StatusBadge>
                    <p>{selectedReview.riskSummary}</p>
                  </div>
                </div>
                <div className="sourceObjectBar">
                  <div>
                    <span>来源对象</span>
                    <strong>{selectedReview.source.id}</strong>
                    <p>{sourceLabel[selectedReview.source.type]} · {selectedReview.source.routeLabel}</p>
                  </div>
                  <a className="secondaryButton" href={selectedReview.source.href}>
                    对象入口
                  </a>
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="证据摘要" description="只展示上游 DTO evidence summary，不在页面层重新计算结论。" />
              <PanelBody>
                <div className="evidenceList">
                  {selectedReview.evidenceSummary.map((evidence) => (
                    <div className="evidenceRow" key={evidence.id}>
                      <span>{evidence.label}</span>
                      <strong>{evidence.value}</strong>
                      <a href={evidence.href}>{evidence.source}</a>
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader title="Decision Bar" description="批准、驳回和修改动作只更新 Review 决策状态。" />
              <PanelBody className="decisionPanelBody">
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} aria-label="Decision comment" />
                <div className="decisionActions">
                  <button className="primaryButton" type="button" onClick={() => applyDecision('approve')}>
                    批准
                  </button>
                  <button className="secondaryButton" type="button" onClick={() => applyDecision('request_changes')}>
                    要求修改
                  </button>
                  <button className="secondaryButton" type="button" onClick={() => applyDecision('reject')}>
                    驳回
                  </button>
                </div>
                {selectedReview.decisionComment ? (
                  <p className="decisionFeedback">
                    最近决策：{selectedReview.decisionComment} · {selectedReview.decidedAt}
                  </p>
                ) : null}
                {lastAction ? <p className="decisionFeedback">{lastAction}</p> : null}
                {apiError ? <p className="decisionFeedback">Fallback：{apiError}</p> : null}
              </PanelBody>
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  )
}
