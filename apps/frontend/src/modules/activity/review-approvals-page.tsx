'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, CheckCircle2, ChevronRight, Edit, FileCheck, HelpCircle, Package, Search, ShieldAlert, SlidersHorizontal, X, XCircle } from 'lucide-react'
import type { ReviewDetailDto, ReviewListItemDto, ReviewRiskLevel, ReviewWorkbenchStatus, ReviewWorkbenchType } from '../../../../contracts/types/reviewReportCenter'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './review-approvals.module.css'

type ReviewDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
type ReviewTab = 'all' | ReviewWorkbenchStatus
type ReviewDetailTab = 'recommendation' | 'risk' | 'evidence' | 'rules' | 'history'
interface ActionLink {
  href: string
  label: string
}

const tabCopy: Array<{ value: ReviewTab; label: string }> = [
  { value: 'PENDING', label: '待审批建议' },
  { value: 'APPROVED', label: '已批准' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'MODIFIED', label: '已修改' },
  { value: 'all', label: '全部' },
]

const decisionStatusCopy: Record<ReviewDecision, string> = {
  APPROVE: '批准',
  REJECT: '驳回',
  REQUEST_CHANGES: '修改后批准',
}

const detailTabs: Array<{ value: ReviewDetailTab; label: string }> = [
  { value: 'recommendation', label: '建议' },
  { value: 'risk', label: '风险' },
  { value: 'evidence', label: '证据' },
  { value: 'rules', label: '相关规则' },
  { value: 'history', label: '审批记录' },
]

export function ReviewApprovalsPage() {
  const [reviews, setReviews] = useState<ReviewListItemDto[]>([])
  const [selectedItem, setSelectedItem] = useState<string | null>(() => getInitialReviewItemId())
  const [detail, setDetail] = useState<ReviewDetailDto | null>(null)
  const [activeTab, setActiveTab] = useState<ReviewTab>(() => getInitialReviewTab())
  const [detailTab, setDetailTab] = useState<ReviewDetailTab>(() => getInitialReviewDetailTab())
  const [typeFilter, setTypeFilter] = useState<ReviewWorkbenchType | 'all'>(() => getInitialReviewType())
  const [riskFilter, setRiskFilter] = useState<ReviewRiskLevel | 'all'>(() => getInitialReviewRisk())
  const [query, setQuery] = useState(() => getInitialReviewParam('q') ?? '')
  const [page, setPage] = useState(() => getInitialReviewPage())
  const [total, setTotal] = useState(0)
  const [remark, setRemark] = useState('')
  const [draftRecommendation, setDraftRecommendation] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<ActionLink | null>(null)

  const loadReviews = async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
    })
    if (activeTab !== 'all') params.set('tab', activeTab)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (riskFilter !== 'all') params.set('riskLevel', riskFilter)
    if (query.trim()) params.set('q', query.trim())
    syncReviewUrl({ reviewItemId: selectedItem, activeTab, typeFilter, riskFilter, query, page, detailTab })
    const nextPage = await fetchActivityApi<PageDto<ReviewListItemDto>>(`/api/reviews?${params.toString()}`)
    setReviews(nextPage.items)
    setTotal(nextPage.total)
    setSelectedItem((current) => {
      if (current && nextPage.items.some((item) => item.reviewItemId === current)) return current
      return nextPage.items[0]?.reviewItemId ?? null
    })
    setLoading(false)
  }

  useEffect(() => {
    loadReviews().catch((error: unknown) => {
      setLoading(false)
      setMessage(error instanceof Error ? error.message : 'Review API 加载失败')
    })
  }, [activeTab, typeFilter, riskFilter, query, page])

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null)
      syncReviewUrl({ reviewItemId: null, activeTab, typeFilter, riskFilter, query, page, detailTab })
      return
    }
    let cancelled = false
    fetchActivityApi<ReviewDetailDto>(`/api/reviews/${selectedItem}`)
      .then((nextDetail) => {
        if (!cancelled) {
          setDetail(nextDetail)
          setDraftRecommendation(nextDetail.recommendation.content)
          syncReviewUrl({ reviewItemId: nextDetail.reviewItemId, activeTab, typeFilter, riskFilter, query, page, detailTab })
        }
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [reviews, selectedItem])

  async function applyDecision(decision: ReviewDecision) {
    const target = detail ?? reviews.find((item) => item.reviewItemId === selectedItem)
    if (!target) return
    setBusy(decision)
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<ReviewDetailDto>(`/api/reviews/${target.reviewItemId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          decisionBy: 'frontend_console',
          decisionComment: remark || `${decisionStatusCopy[decision]}：来自 Review 工作台`,
          modifiedPayload: decision === 'REQUEST_CHANGES' ? { requestedFrom: 'review-approvals' } : undefined,
        }),
      })
      setDetail(updated)
      setMessage(`${updated.reviewItemId} 已${decisionStatusCopy[decision]}`)
      setActionLink(reviewActionLink(updated, '查看审批 Run'))
      setRemark('')
      await loadReviews()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审批提交失败')
    } finally {
      setBusy(null)
    }
  }

  async function saveRecommendation() {
    if (!detail) return
    setBusy('save')
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<ReviewDetailDto>(`/api/reviews/${detail.reviewItemId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          recommendation: draftRecommendation,
        }),
      })
      setDetail(updated)
      setReviews((current) => current.map((item) => (item.reviewItemId === updated.reviewItemId ? listItemFromDetail(updated) : item)))
      setMessage(`已保存 Review 建议：${updated.reviewItemId}`)
      setActionLink(reviewActionLink(updated, '查看保存 Run'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存建议失败')
    } finally {
      setBusy(null)
    }
  }

  const selectedReview = detail ?? reviews.find((item) => item.reviewItemId === selectedItem) ?? null
  const openCount = activeTab === 'PENDING' ? total : reviews.filter((item) => item.status === 'PENDING').length
  const totalPages = Math.max(1, Math.ceil(total / 20))
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/review-approvals',
    pageTitle: 'Review 审批工作台',
    selectedEntity: {
      entityType: 'reviewItem',
      entityId: selectedReview?.reviewItemId ?? selectedItem ?? 'review-approvals',
      label: selectedReview?.title ?? selectedReview?.summary ?? 'Review 审批工作台',
    },
    visibleFilters: {
      activeTab,
      typeFilter,
      riskFilter,
      query,
      page,
      detailTab,
      selectedStatus: selectedReview?.status,
      decisionCommentDraft: remark,
      recommendationDraft: draftRecommendation,
    },
    visibleColumns: ['priority', 'type', 'recommendation', 'status', 'riskLevel', 'owner'],
  }), [activeTab, detailTab, draftRecommendation, page, query, remark, riskFilter, selectedItem, selectedReview?.reviewItemId, selectedReview?.status, selectedReview?.summary, selectedReview?.title, typeFilter])

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className={styles.layout}>
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          Review工作台 <ChevronRight size={14} /> 待审批建议
        </div>

        <h1 className={styles.pageTitle}>Review 工作台</h1>

        <div className={styles.tabs}>
          {tabCopy.map((tab) => (
            <button className={`${styles.tab} ${activeTab === tab.value ? styles.active : ''}`} key={tab.value} type="button" onClick={() => { setActiveTab(tab.value); setPage(1) }}>
              {tab.label} {tab.value === 'PENDING' ? <span className={styles.tabBadge}>{openCount}</span> : null}
            </button>
          ))}
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <select className={styles.filterSelect} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as ReviewWorkbenchType | 'all'); setPage(1) }}>
              <option value="all">全部类型</option>
              <option value="REPLENISHMENT">补货建议</option>
              <option value="CERTIFICATE">健康诊断</option>
              <option value="RULE_AMBIGUITY">规则口径</option>
              <option value="ACTIVITY_CONFLICT">活动冲突</option>
              <option value="PRICE">价格确认</option>
              <option value="AGENT_REVIEW_GATE">Agent Gate</option>
            </select>
            <select className={styles.filterSelect} value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value as ReviewRiskLevel | 'all'); setPage(1) }}>
              <option value="all">全部风险等级</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <div className={styles.filterSelect}>状态：{activeTab === 'all' ? '全部' : activeTab}</div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.searchInput}>
              <Search size={14} color="var(--muted)" />
              <input type="text" placeholder="搜索建议、SKU、任务ID、负责人" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
            </div>
            <button className="secondaryButton" style={{ padding: '6px 12px' }} type="button" onClick={() => void loadReviews()}>
              <SlidersHorizontal size={14} /> 刷新
            </button>
          </div>
        </div>

        {message ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px' }}>
            {message}
            {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
          </div>
        ) : null}

        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <div></div>
            <div>优先级</div>
            <div>类型</div>
            <div>建议摘要</div>
            <div>状态</div>
            <div>风险等级</div>
            <div>负责人</div>
            <div>来源</div>
            <div>证据摘要</div>
          </div>

          {reviews.map((item) => (
            <button className={`${styles.tableRow} ${selectedItem === item.reviewItemId ? styles.selected : ''}`} key={item.reviewItemId} type="button" onClick={() => { setSelectedItem(item.reviewItemId); syncReviewUrl({ reviewItemId: item.reviewItemId, activeTab, typeFilter, riskFilter, query, page, detailTab }) }}>
              <div><input type="radio" checked={selectedItem === item.reviewItemId} readOnly /></div>
              <div><span className={`${styles.priorityBadge} ${priorityClass(item.riskLevel)}`}>{priorityLabel(item.riskLevel)}</span></div>
              <div className={styles.rowType}>{reviewIcon(item.type)} {sourceTypeLabel(item.type)}</div>
              <div>
                <div className={styles.rowTitle}>{item.title}</div>
                <div className={styles.rowDesc}>{item.summary}</div>
              </div>
              <div><span className={styles.statusBadge}>{statusLabel(item.status)}</span></div>
              <div className={styles.riskLevel}><span className={`${styles.riskDot} ${riskDotClass(item.riskLevel)}`}></span> {item.riskLevel}</div>
              <div className={styles.ownerBlock}>
                <div className={styles.ownerAvatar}>{ownerInitials(item.assignee.name)}</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{item.assignee.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.assignee.team}</div>
                </div>
              </div>
              <div>{item.assignee.userId ?? item.assignee.team}</div>
              <div>
                <div style={{ fontSize: '12px' }}>{item.evidenceSummary}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.dueAt ? new Date(item.dueAt).toLocaleString('zh-CN') : '未设置到期时间'}</div>
              </div>
            </button>
          ))}

          {!loading && reviews.length === 0 ? <div style={{ padding: '24px', color: 'var(--muted)' }}>没有符合条件的 Review 项。</div> : null}
        </div>

        <div className={styles.tableFooter}>
          <div>共 {total} 条</div>
          <div className={styles.pagination}>
            <button className={styles.pageBtn} type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
            <span>{page} / {totalPages}</span>
            <button className={styles.pageBtn} type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>›</button>
          </div>
        </div>
      </div>

      {selectedReview && (
        <div className={styles.drawer}>
          <div className={styles.drawerHeader}>
            <div>
              <div className={styles.drawerTitle}>
                {reviewIcon(selectedReview.type)}
                {selectedReview.title}
                <span className={styles.drawerRisk}>{selectedReview.riskLevel}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                Review ID: {selectedReview.reviewItemId}
              </div>
            </div>
            <button className="iconButton" type="button" onClick={() => { setSelectedItem(null); syncReviewUrl({ reviewItemId: null, activeTab, typeFilter, riskFilter, query, page, detailTab }) }}><X size={18} color="var(--muted)" /></button>
          </div>

          <div className={styles.drawerBody}>
            <div className={styles.drawerTabs}>
              {detailTabs.map((tab) => (
                <button className={`${styles.tab} ${detailTab === tab.value ? styles.active : ''}`} key={tab.value} type="button" onClick={() => { setDetailTab(tab.value); syncReviewUrl({ reviewItemId: selectedReview.reviewItemId, activeTab, typeFilter, riskFilter, query, page, detailTab: tab.value }) }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {detailTab === 'recommendation' ? (
              <RecommendationTab selectedReview={selectedReview} draftRecommendation={draftRecommendation} setDraftRecommendation={setDraftRecommendation} saveRecommendation={saveRecommendation} busy={busy} />
            ) : null}
            {detailTab === 'risk' ? <RiskTab selectedReview={selectedReview} /> : null}
            {detailTab === 'evidence' ? <EvidenceTab selectedReview={selectedReview} /> : null}
            {detailTab === 'rules' ? <RulesTab selectedReview={selectedReview} /> : null}
            {detailTab === 'history' ? <HistoryTab selectedReview={selectedReview} /> : null}

            <div className={styles.approvalWarning}>
              <ShieldAlert size={20} color="#d97706" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>需要人工审批</div>
                <div className={styles.approvalWarningText}>该操作会影响后续任务执行，必须保留人工审批记录。</div>
              </div>
            </div>

            <div className={styles.actionArea}>
              <button className={`${styles.actionBtn} ${styles.btnApprove}`} type="button" onClick={() => void applyDecision('APPROVE')} disabled={!!busy || selectedReview.status !== 'PENDING'}><CheckCircle2 size={16} /> 批准</button>
              <button className={`${styles.actionBtn} ${styles.btnReject}`} type="button" onClick={() => void applyDecision('REJECT')} disabled={!!busy || selectedReview.status !== 'PENDING'}><XCircle size={16} /> 驳回</button>
              <button className={`${styles.actionBtn} ${styles.btnModify}`} type="button" onClick={() => void applyDecision('REQUEST_CHANGES')} disabled={!!busy || selectedReview.status !== 'PENDING'}><Edit size={16} /> 修改后批准</button>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>备注 (选填)</div>
            <textarea className={styles.remarkInput} placeholder="请输入审批备注，便于后续追溯..." value={remark} onChange={(event) => setRemark(event.target.value)} />
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function statusLabel(status: ReviewWorkbenchStatus) {
  if (status === 'PENDING') return '待审批'
  if (status === 'APPROVED') return '已批准'
  if (status === 'REJECTED') return '已驳回'
  return '需修改'
}

function sourceTypeLabel(sourceType: ReviewWorkbenchType) {
  if (sourceType === 'CERTIFICATE') return '健康诊断'
  if (sourceType === 'ACTIVITY_CONFLICT') return '活动模拟'
  if (sourceType === 'RULE_AMBIGUITY') return '规则口径'
  if (sourceType === 'REPLENISHMENT') return '补货建议'
  if (sourceType === 'PRICE') return '价格确认'
  return 'Agent Gate'
}

function priorityLabel(riskLevel: ReviewRiskLevel) {
  if (riskLevel === 'HIGH') return 'P1'
  if (riskLevel === 'MEDIUM') return 'P2'
  return 'P3'
}

function priorityClass(riskLevel: ReviewRiskLevel) {
  if (riskLevel === 'HIGH') return styles.p1
  if (riskLevel === 'MEDIUM') return styles.p2
  return styles.p3
}

function riskDotClass(riskLevel: ReviewRiskLevel) {
  if (riskLevel === 'HIGH') return styles.high
  if (riskLevel === 'MEDIUM') return styles.medium
  return styles.low
}

function reviewIcon(sourceType: ReviewWorkbenchType) {
  if (sourceType === 'REPLENISHMENT') return <Package size={14} color="#d97706" />
  if (sourceType === 'CERTIFICATE') return <FileCheck size={14} color="#2563eb" />
  if (sourceType === 'AGENT_REVIEW_GATE') return <HelpCircle size={14} color="#64748b" />
  return <AlertOctagon size={14} color="#e11d48" />
}

function ownerInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'OP'
  return trimmed.slice(0, 2).toUpperCase()
}

function RecommendationTab({ selectedReview, draftRecommendation, setDraftRecommendation, saveRecommendation, busy }: {
  selectedReview: ReviewDetailDto | ReviewListItemDto
  draftRecommendation: string
  setDraftRecommendation: (value: string) => void
  saveRecommendation: () => Promise<void>
  busy: string | null
}) {
  return (
    <section>
      <div className={styles.drawerSectionTitle}>建议内容</div>
      {isReviewDetail(selectedReview) ? (
        <div>
          <textarea className={styles.remarkInput} value={draftRecommendation} onChange={(event) => setDraftRecommendation(event.target.value)} />
          <button className="secondaryButton" type="button" onClick={() => void saveRecommendation()} disabled={busy === 'save' || selectedReview.status !== 'PENDING'} style={{ marginBottom: '20px' }}>保存建议修改</button>
          <div className={styles.metricGrid}>
            {selectedReview.recommendation.metrics?.map((metric) => (
              <div className={styles.metricItem} key={metric.label}><span className={styles.metricLabel}>{metric.label}</span><span className={styles.metricValue}>{metric.value}</span></div>
            ))}
          </div>
          {selectedReview.recommendation.expectedEffect ? <div className={styles.suggestionBox}>{selectedReview.recommendation.expectedEffect}</div> : null}
        </div>
      ) : <div className={styles.suggestionBox}>{selectedReview.summary}</div>}
    </section>
  )
}

function RiskTab({ selectedReview }: { selectedReview: ReviewDetailDto | ReviewListItemDto }) {
  return (
    <section>
      <div className={styles.drawerSectionTitle}>风险摘要</div>
      <div className={styles.metricGrid}>
        <div className={styles.metricItem}><span className={styles.metricLabel}>状态</span><span className={styles.metricValue}>{statusLabel(selectedReview.status)}</span></div>
        <div className={styles.metricItem}><span className={styles.metricLabel}>风险等级</span><span className={styles.metricValue}>{selectedReview.riskLevel}</span></div>
        <div className={styles.metricItem}><span className={styles.metricLabel}>优先级</span><span className={styles.metricValue}>{selectedReview.priority}</span></div>
        <div className={styles.metricItem}><span className={styles.metricLabel}>来源</span><span className={styles.metricValue}>{selectedReview.type}</span></div>
      </div>
      <div className={styles.suggestionBox}>{isReviewDetail(selectedReview) ? selectedReview.riskIfIgnored : selectedReview.summary}</div>
    </section>
  )
}

function EvidenceTab({ selectedReview }: { selectedReview: ReviewDetailDto | ReviewListItemDto }) {
  const evidenceRefs = isReviewDetail(selectedReview) ? selectedReview.evidenceRefs : []
  return (
    <section>
      <div className={styles.drawerSectionTitle}>证据列表</div>
      <div className={styles.detailList}>
        {evidenceRefs.length ? evidenceRefs.map((evidence) => (
          <div className={styles.detailCard} key={`${evidence.sourceType}:${evidence.sourceId}:${evidence.field ?? evidence.label}`}>
            <div className={styles.detailCardTitle}>{evidence.label}</div>
            <div className={styles.detailCardMeta}>{evidence.entityType} / {evidence.entityId}</div>
            <div>{evidence.evidenceText ?? evidence.field ?? evidence.sourceId}</div>
          </div>
        )) : <div className={styles.emptyState}>{selectedReview.evidenceSummary}</div>}
      </div>
    </section>
  )
}

function RulesTab({ selectedReview }: { selectedReview: ReviewDetailDto | ReviewListItemDto }) {
  const rules = isReviewDetail(selectedReview) ? selectedReview.relatedRules : []
  return (
    <section>
      <div className={styles.drawerSectionTitle}>相关规则</div>
      <div className={styles.detailList}>
        {rules.length ? rules.map((rule) => (
          <div className={styles.detailCard} key={`${rule.entityType}:${rule.entityId}`}>
            <div className={styles.detailCardTitle}>{rule.label}</div>
            <div className={styles.detailCardMeta}>{rule.entityType} / {rule.entityId}</div>
            {rule.href ? <a href={rule.href} style={{ color: 'var(--primary)' }}>打开规则</a> : null}
          </div>
        )) : <div className={styles.emptyState}>当前 Review 未关联规则。</div>}
      </div>
    </section>
  )
}

function HistoryTab({ selectedReview }: { selectedReview: ReviewDetailDto | ReviewListItemDto }) {
  const history = isReviewDetail(selectedReview) ? selectedReview.approvalHistory : []
  return (
    <section>
      <div className={styles.drawerSectionTitle}>审批记录</div>
      <div className={styles.detailList}>
        {history.length ? history.map((item) => (
          <div className={styles.detailCard} key={`${item.actor}:${item.action}:${item.createdAt}`}>
            <div className={styles.detailCardTitle}>{item.action}</div>
            <div className={styles.detailCardMeta}>{item.actor} / {new Date(item.createdAt).toLocaleString('zh-CN')}</div>
            {item.comment ? <div>{item.comment}</div> : null}
            {item.workflowRunId ? <a href={runConsoleHref(item.workflowRunId)} style={{ color: 'var(--primary)' }}>查看 Run</a> : null}
          </div>
        )) : <div className={styles.emptyState}>暂无审批记录。</div>}
      </div>
    </section>
  )
}

function listItemFromDetail(detail: ReviewDetailDto): ReviewListItemDto {
  return {
    reviewItemId: detail.reviewItemId,
    priority: detail.priority,
    type: detail.type,
    title: detail.title,
    summary: detail.summary,
    status: detail.status,
    riskLevel: detail.riskLevel,
    assignee: detail.assignee,
    dueAt: detail.dueAt,
    evidenceSummary: detail.evidenceSummary,
  }
}

function isReviewDetail(item: ReviewDetailDto | ReviewListItemDto): item is ReviewDetailDto {
  return 'evidenceRefs' in item
}

function reviewActionLink(detail: ReviewDetailDto, label: string): ActionLink {
  const latestRunId = [...detail.approvalHistory].reverse().find((item) => item.workflowRunId)?.workflowRunId
  return latestRunId
    ? { href: runConsoleHref(latestRunId), label }
    : { href: reviewApprovalHref(detail.reviewItemId), label: '查看 Review' }
}

function reviewApprovalHref(reviewItemId: string): string {
  const params = new URLSearchParams({ reviewItemId })
  return `/review-approvals?${params.toString()}`
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function getInitialReviewItemId(): string | null {
  return getInitialReviewParam('reviewItemId')
}

function getInitialReviewParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function getInitialReviewPage(): number {
  const value = Number(getInitialReviewParam('page') ?? 1)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}

function getInitialReviewTab(): ReviewTab {
  const value = getInitialReviewParam('tab')
  return value === 'PENDING' || value === 'APPROVED' || value === 'REJECTED' || value === 'MODIFIED' || value === 'all' ? value : 'PENDING'
}

function getInitialReviewDetailTab(): ReviewDetailTab {
  const value = getInitialReviewParam('detailTab')
  return value === 'recommendation' || value === 'risk' || value === 'evidence' || value === 'rules' || value === 'history' ? value : 'recommendation'
}

function getInitialReviewType(): ReviewWorkbenchType | 'all' {
  const value = getInitialReviewParam('type')
  return value === 'REPLENISHMENT' || value === 'CERTIFICATE' || value === 'RULE_AMBIGUITY' || value === 'ACTIVITY_CONFLICT' || value === 'PRICE' || value === 'AGENT_REVIEW_GATE' ? value : 'all'
}

function getInitialReviewRisk(): ReviewRiskLevel | 'all' {
  const value = getInitialReviewParam('riskLevel')
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW' ? value : 'all'
}

function syncReviewUrl(state: {
  reviewItemId: string | null
  activeTab: ReviewTab
  typeFilter: ReviewWorkbenchType | 'all'
  riskFilter: ReviewRiskLevel | 'all'
  query: string
  page: number
  detailTab: ReviewDetailTab
}) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (state.reviewItemId) params.set('reviewItemId', state.reviewItemId)
  if (state.activeTab !== 'PENDING') params.set('tab', state.activeTab)
  if (state.typeFilter !== 'all') params.set('type', state.typeFilter)
  if (state.riskFilter !== 'all') params.set('riskLevel', state.riskFilter)
  if (state.query.trim()) params.set('q', state.query.trim())
  if (state.page > 1) params.set('page', String(state.page))
  if (state.detailTab !== 'recommendation') params.set('detailTab', state.detailTab)
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}
