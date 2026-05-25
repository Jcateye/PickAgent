'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, CheckCircle2, ChevronRight, Edit, FileCheck, HelpCircle, Package, Search, ShieldAlert, SlidersHorizontal, X, XCircle } from 'lucide-react'
import type { ReviewDetailDto, ReviewListItemDto, ReviewRiskLevel, ReviewWorkbenchStatus, ReviewWorkbenchType } from '../../../../contracts/types/reviewReportCenter'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './review-approvals.module.css'

type ReviewDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
type ReviewTab = 'all' | ReviewWorkbenchStatus

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

export function ReviewApprovalsPage() {
  const [reviews, setReviews] = useState<ReviewListItemDto[]>([])
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReviewDetailDto | null>(null)
  const [activeTab, setActiveTab] = useState<ReviewTab>('PENDING')
  const [query, setQuery] = useState('')
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadReviews = async () => {
    setLoading(true)
    const page = await fetchActivityApi<PageDto<ReviewListItemDto>>('/api/reviews?pageSize=50')
    setReviews(page.items)
    setSelectedItem((current) => current && page.items.some((item) => item.reviewItemId === current) ? current : page.items[0]?.reviewItemId ?? null)
    setLoading(false)
  }

  useEffect(() => {
    loadReviews().catch((error: unknown) => {
      setLoading(false)
      setMessage(error instanceof Error ? error.message : 'Review API 加载失败')
    })
  }, [])

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null)
      return
    }
    let cancelled = false
    fetchActivityApi<ReviewDetailDto>(`/api/reviews/${selectedItem}`)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [reviews, selectedItem])

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return reviews.filter((item) => {
      const tabMatched = activeTab === 'all' || item.status === activeTab
      const queryMatched = !normalizedQuery || [item.reviewItemId, item.title, item.summary, item.assignee.name, item.assignee.team].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery))
      return tabMatched && queryMatched
    })
  }, [activeTab, query, reviews])

  async function applyDecision(decision: ReviewDecision) {
    const target = detail ?? reviews.find((item) => item.reviewItemId === selectedItem)
    if (!target) return
    setBusy(decision)
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
      setReviews((current) => current.map((item) => (item.reviewItemId === updated.reviewItemId ? listItemFromDetail(updated) : item)))
      setDetail(updated)
      setMessage(`${updated.reviewItemId} 已${decisionStatusCopy[decision]}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审批提交失败')
    } finally {
      setBusy(null)
    }
  }

  const selectedReview = detail ?? reviews.find((item) => item.reviewItemId === selectedItem) ?? null
  const openCount = reviews.filter((item) => item.status === 'PENDING').length

  return (
    <div className={styles.layout}>
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          Review工作台 <ChevronRight size={14} /> 待审批建议
        </div>

        <h1 className={styles.pageTitle}>Review 工作台</h1>

        <div className={styles.tabs}>
          {tabCopy.map((tab) => (
            <button className={`${styles.tab} ${activeTab === tab.value ? styles.active : ''}`} key={tab.value} type="button" onClick={() => setActiveTab(tab.value)}>
              {tab.label} {tab.value === 'PENDING' ? <span className={styles.tabBadge}>{openCount}</span> : null}
            </button>
          ))}
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <div className={styles.filterSelect}>全部类型 <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></div>
            <div className={styles.filterSelect}>全部风险等级 <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></div>
            <div className={styles.filterSelect}>状态：{activeTab === 'all' ? '全部' : activeTab}</div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.searchInput}>
              <Search size={14} color="var(--muted)" />
              <input type="text" placeholder="搜索建议、SKU、任务ID、负责人" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <button className="secondaryButton" style={{ padding: '6px 12px' }} type="button" onClick={() => void loadReviews()}>
              <SlidersHorizontal size={14} /> 刷新
            </button>
          </div>
        </div>

        {message ? <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px' }}>{message}</div> : null}

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

          {filteredReviews.map((item) => (
            <button className={`${styles.tableRow} ${selectedItem === item.reviewItemId ? styles.selected : ''}`} key={item.reviewItemId} type="button" onClick={() => setSelectedItem(item.reviewItemId)}>
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
                <div className={styles.ownerAvatar}>OP</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>运营专员</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.assignee.team}</div>
                </div>
              </div>
              <div>{item.assignee.name}</div>
              <div>
                <div style={{ fontSize: '12px' }}>{item.evidenceSummary}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.dueAt ? new Date(item.dueAt).toLocaleString('zh-CN') : '未设置到期时间'}</div>
              </div>
            </button>
          ))}

          {!loading && filteredReviews.length === 0 ? <div style={{ padding: '24px', color: 'var(--muted)' }}>没有符合条件的 Review 项。</div> : null}
        </div>

        <div className={styles.tableFooter}>
          <div>共 {filteredReviews.length} 条</div>
          <div className={styles.pagination}>真实分页待接入；当前显示前 50 条。</div>
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
            <button className="iconButton" type="button" onClick={() => setSelectedItem(null)}><X size={18} color="var(--muted)" /></button>
          </div>

          <div className={styles.drawerBody}>
            <div className={styles.drawerTabs}>
              <div className={`${styles.tab} ${styles.active}`}>建议</div>
              <div className={styles.tab}>风险</div>
              <div className={styles.tab}>证据</div>
              <div className={styles.tab}>相关规则</div>
              <div className={styles.tab}>审批记录</div>
            </div>

            <div style={{ fontWeight: 600, marginBottom: '12px' }}>建议内容</div>
            <div className={styles.suggestionBox}>{isReviewDetail(selectedReview) ? selectedReview.recommendation.content : selectedReview.summary}</div>

            <div className={styles.metricGrid}>
              <div className={styles.metricItem}><span className={styles.metricLabel}>状态</span><span className={styles.metricValue}>{statusLabel(selectedReview.status)}</span></div>
              <div className={styles.metricItem}><span className={styles.metricLabel}>风险等级</span><span className={styles.metricValue}>{selectedReview.riskLevel}</span></div>
              <div className={styles.metricItem}><span className={styles.metricLabel}>证据数</span><span className={styles.metricValue}>{isReviewDetail(selectedReview) ? selectedReview.evidenceRefs.length : 0}</span></div>
              <div className={styles.metricItem}><span className={styles.metricLabel}>来源</span><span className={styles.metricValue}>{selectedReview.type}</span></div>
            </div>

            <div style={{ fontWeight: 600, marginBottom: '12px' }}>理由与依据</div>
            <ul className={styles.reasonsList}>
              {isReviewDetail(selectedReview) ? selectedReview.evidenceRefs.map((evidence) => (
                <li key={`${evidence.sourceType}:${evidence.sourceId}`}>{evidence.label}：{evidence.evidenceText ?? evidence.field ?? evidence.sourceId}</li>
              )) : <li>{selectedReview.evidenceSummary}</li>}
            </ul>

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
