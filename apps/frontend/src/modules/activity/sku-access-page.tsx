'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Wrench, HelpCircle, XCircle, Search, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DashboardSkuListItemDto, DashboardSkuReadinessDetailDto } from '../../../../contracts/types/dashboardSkuReadModels'
import type { ReportPreviewDto, ReviewItemDto } from '../../../../contracts/types/businessFoundation'
import { fetchActivityApi, type HealthSummaryDto, type PageDto } from './api-client'
import styles from './sku-access.module.css'

type SkuDrawerTab = 'overview' | 'evidence' | 'raw' | 'history'

const skuDrawerTabs: Array<{ value: SkuDrawerTab; label: string }> = [
  { value: 'overview', label: '概览' },
  { value: 'evidence', label: '证据' },
  { value: 'raw', label: '原始字段' },
  { value: 'history', label: '历史' },
]

export function SkuAccessPage() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [summary, setSummary] = useState<HealthSummaryDto | null>(null)
  const [skuPage, setSkuPage] = useState<PageDto<DashboardSkuListItemDto> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedDetail, setSelectedDetail] = useState<DashboardSkuReadinessDetailDto | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [healthStatus, setHealthStatus] = useState<DashboardSkuListItemDto['healthStatus'] | 'ALL'>('ALL')
  const [drawerTab, setDrawerTab] = useState<SkuDrawerTab>('overview')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '20',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })
    if (healthStatus !== 'ALL') params.set('healthStatus', healthStatus)
    Promise.all([
      fetchActivityApi<HealthSummaryDto>('/api/health/summary'),
      fetchActivityApi<PageDto<DashboardSkuListItemDto>>(`/api/skus?${params.toString()}`),
    ])
      .then(([nextSummary, nextSkuPage]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setSkuPage(nextSkuPage)
        setSelectedId((current) => nextSkuPage.items.some((item) => item.skuProfileId === current) ? current : nextSkuPage.items[0]?.skuProfileId ?? null)
        setSelectedIds((current) => current.filter((id) => nextSkuPage.items.some((item) => item.skuProfileId === id)))
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null)
          setSkuPage(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [page, healthStatus])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    fetchActivityApi<DashboardSkuReadinessDetailDto>(`/api/skus/${selectedId}`)
      .then((detail) => {
        if (!cancelled) setSelectedDetail(detail)
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const sourceRows = skuPage?.items ?? []
    return sourceRows.filter((item) => !normalizedQuery || [item.displaySku, item.productName, item.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery)))
  }, [query, skuPage])
  const selectedRow = rows.find((item) => item.skuProfileId === selectedId) ?? rows[0]
  const selectedRows = rows.filter((item) => selectedIds.includes(item.skuProfileId))
  const allVisibleSelected = rows.length > 0 && rows.every((item) => selectedIds.includes(item.skuProfileId))
  const totalPages = Math.max(1, Math.ceil((skuPage?.total ?? 0) / (skuPage?.pageSize ?? 20)))
  const visiblePages = paginationWindow(page, totalPages)
  const stats = useMemo(() => {
    const total = summary?.total ?? rows.length
    const ready = summary?.ready ?? rows.filter((item) => item.healthStatus === 'READY').length
    const blocked = summary?.blocked ?? rows.filter((item) => item.healthStatus === 'BLOCKED').length
    const repairable = summary?.warning ?? rows.filter((item) => item.healthStatus === 'REPAIRABLE' || item.healthStatus === 'RISKY').length
    const review = rows.filter((item) => item.nextAction.type === 'MANUAL_REVIEW').length
    return {
      total,
      ready,
      repairable,
      review,
      blocked,
      readyPct: pct(ready, total),
      repairablePct: pct(repairable, total),
      reviewPct: pct(review, total),
      blockedPct: pct(blocked, total),
    }
  }, [rows, summary])

  async function createReview(item: DashboardSkuListItemDto) {
    await createReviews([item])
  }

  async function createReviews(items: DashboardSkuListItemDto[]) {
    if (!items.length) {
      setMessage('请先选择 SKU')
      return
    }
    const busyKey = items.length === 1 ? items[0].skuProfileId : 'bulk-review'
    setBusy(busyKey)
    try {
      const created = await fetchActivityApi<ReviewItemDto[]>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => ({
            skuProfileId: item.skuProfileId,
            sourceType: 'health',
            sourceId: item.skuProfileId,
            question: `确认 ${item.displaySku} 的活动准入下一步`,
            recommendation: item.nextAction.label,
            riskLevel: item.healthStatus === 'BLOCKED' || item.healthStatus === 'RISKY' ? 'L2' : 'L1',
            evidence: [
              {
                type: 'diagnosis',
                entityId: item.skuProfileId,
                label: item.productName,
                summary: item.eligibilityLabel,
              },
            ],
          })),
        }),
      })
      setMessage(`已生成 Review：${created.map((item) => item.reviewItemId).join(', ')}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成 Review 失败')
    } finally {
      setBusy(null)
    }
  }

  async function updateNextAction(item: DashboardSkuListItemDto) {
    await updateNextActions([item])
  }

  async function updateNextActions(items: DashboardSkuListItemDto[]) {
    if (!items.length) {
      setMessage('请先选择 SKU')
      return
    }
    if (items.length > 1) {
      setBusy('bulk-next')
      try {
        const details = await Promise.all(items.map((item) => fetchActivityApi<DashboardSkuReadinessDetailDto>(`/api/skus/${item.skuProfileId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nextAction: item.nextAction,
            comment: 'sku-access-page-bulk',
          }),
        })))
        const updatedIds = new Set(items.map((item) => item.skuProfileId))
        setSkuPage((current) => current ? {
          ...current,
          items: current.items.map((row) => updatedIds.has(row.skuProfileId) ? { ...row, nextAction: { ...row.nextAction } } : row),
        } : current)
        const selected = details.find((detail) => detail.skuProfileId === selectedId)
        if (selected) setSelectedDetail(selected)
        setMessage(`已批量设置下一步：${items.length} 个 SKU`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '批量设置下一步失败')
      } finally {
        setBusy(null)
      }
      return
    }
    const item = items[0]
    setBusy(`next:${item.skuProfileId}`)
    try {
      const detail = await fetchActivityApi<DashboardSkuReadinessDetailDto>(`/api/skus/${item.skuProfileId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextAction: item.nextAction,
          comment: 'sku-access-page',
        }),
      })
      setSelectedDetail(detail)
      setSkuPage((current) => current ? {
        ...current,
        items: current.items.map((row) => row.skuProfileId === item.skuProfileId ? { ...row, nextAction: { ...item.nextAction } } : row),
      } : current)
      setMessage(`已设置下一步：${detail.statusSummary.nextStep}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '设置下一步失败')
    } finally {
      setBusy(null)
    }
  }

  async function generateHealthReport() {
    const skuProfileIds = rows.map((item) => item.skuProfileId)
    if (!skuProfileIds.length) {
      setMessage('当前筛选结果为空，无法生成报告')
      return
    }
    setBusy('report')
    try {
      const report = await fetchActivityApi<ReportPreviewDto>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          type: 'HEALTH',
          skuProfileIds,
        }),
      })
      setMessage(`已生成健康报告：${report.reportId}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成健康报告失败')
    } finally {
      setBusy(null)
    }
  }

  function toggleAllRows() {
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !rows.some((item) => item.skuProfileId === id)) : Array.from(new Set([...current, ...rows.map((item) => item.skuProfileId)])))
  }

  function toggleRowSelection(skuProfileId: string) {
    setSelectedIds((current) => current.includes(skuProfileId) ? current.filter((id) => id !== skuProfileId) : [...current, skuProfileId])
  }

  return (
    <div className={styles.layout}>
      <div className={styles.mainArea}>
        <div className="pageHeader">
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>SKU 准入工作台</h1>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>按 SKU 维度查看准入状态、核心原因与下一步建议，可批量处理并生成 Review。</p>
            {message ? <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>{message}</p> : null}
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            活动
            <select className={styles.filterSelect}>
              <option>天猫618大促</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            平台
            <select className={styles.filterSelect}>
              <option>全部</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            类目
            <select className={styles.filterSelect}>
              <option>全部</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            状态
            <select className={styles.filterSelect} value={healthStatus} onChange={(event) => { setHealthStatus(event.target.value as DashboardSkuListItemDto['healthStatus'] | 'ALL'); setPage(1) }}>
              <option value="ALL">全部</option>
              <option value="READY">可直接报名</option>
              <option value="REPAIRABLE">可修复</option>
              <option value="RISKY">待人工确认</option>
              <option value="BLOCKED">不建议报名</option>
            </select>
          </div>
          <div style={{ flex: 1 }}></div>
          <div className={styles.searchBox}>
            <Search size={16} color="var(--muted)" />
            <input type="text" placeholder="搜索 SKU / 商品名 / SPU" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <button className="secondaryButton" type="button" onClick={() => { setQuery(''); setHealthStatus('ALL'); setPage(1) }} style={{ height: '32px' }}>重置</button>
        </div>

        <div className={styles.summaryCards}>
          <div className={`${styles.summaryCard} ${styles.active}`}>
            <div className={styles.cardHeader}>
              <CheckCircle2 size={16} className={styles.iconReady} />
              可直接报名
            </div>
            <div className={styles.cardValue}>{stats.ready} <span className={styles.cardPct}>{stats.readyPct}</span></div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <Wrench size={16} className={styles.iconRepair} />
              可修复
            </div>
            <div className={styles.cardValue}>{stats.repairable} <span className={styles.cardPct}>{stats.repairablePct}</span></div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <HelpCircle size={16} className={styles.iconReview} />
              待人工确认
            </div>
            <div className={styles.cardValue}>{stats.review} <span className={styles.cardPct}>{stats.reviewPct}</span></div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <XCircle size={16} className={styles.iconBlocked} />
              不建议报名
            </div>
            <div className={styles.cardValue}>{stats.blocked} <span className={styles.cardPct}>{stats.blockedPct}</span></div>
          </div>
        </div>

        <div className={styles.tableToolbar}>
          <div className={styles.tableToolbarLeft}>已选择 {selectedRows.length} 项</div>
          <div className={styles.tableToolbarRight}>
            <button className="secondaryButton" type="button" onClick={() => void createReviews(selectedRows)} disabled={!selectedRows.length || !!busy} style={{ height: '32px', fontSize: '13px' }}>批量生成 Review</button>
            <button className="secondaryButton" type="button" onClick={() => void updateNextActions(selectedRows)} disabled={!selectedRows.length || !!busy} style={{ height: '32px', fontSize: '13px' }}>批量设置下一步 ∨</button>
            <button className="secondaryButton" type="button" onClick={() => exportRows(rows)} style={{ height: '32px', fontSize: '13px' }}>导出当前结果</button>
            <button className="secondaryButton" type="button" onClick={() => void generateHealthReport()} disabled={!rows.length || busy === 'report'} style={{ height: '32px', fontSize: '13px' }}>生成健康报告</button>
          </div>
        </div>

        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllRows} /></th>
              <th>SKU</th>
              <th style={{ width: '20%' }}>商品名</th>
              <th>类目</th>
              <th>状态</th>
              <th style={{ width: '18%' }}>主要原因</th>
              <th style={{ width: '15%' }}>下一步</th>
              <th>证据</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.skuProfileId} className={selectedId === item.skuProfileId ? styles.rowActive : undefined} onClick={() => { setSelectedId(item.skuProfileId); setDrawerOpen(true) }}>
                <td><input type="checkbox" checked={selectedIds.includes(item.skuProfileId)} onChange={(event) => { event.stopPropagation(); toggleRowSelection(item.skuProfileId) }} onClick={(event) => event.stopPropagation()} /></td>
                <td>{shortSku(item.displaySku)}</td>
                <td className={styles.productCell}>
                  <span className={styles.productName}>{item.productName}</span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{item.category ?? '-'}</td>
                <td>{renderHealthTag(item.healthStatus, styles)}</td>
                <td>{item.eligibilityLabel === '未模拟' ? healthReason(item.healthStatus) : item.eligibilityLabel}</td>
                <td>{item.nextAction.label}</td>
                <td><a href={`/sku-health/${item.skuProfileId}`} style={{ color: 'var(--primary)' }}>查看证据 ({item.evidenceCount})</a></td>
                <td><button type="button" className="secondaryButton" onClick={(event) => { event.stopPropagation(); void createReview(item) }} disabled={busy === item.skuProfileId} style={{ padding: '2px 8px' }}>生成</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', fontSize: '13px', color: 'var(--muted)' }}>
          <span>共 {stats.total.toLocaleString()} 条</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{skuPage?.pageSize ?? 20} 条/页</span>
            <button className="iconButton" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} style={{ width: '28px', height: '28px' }}><ChevronLeft size={16} /></button>
            {visiblePages[0] > 1 ? <span>...</span> : null}
            {visiblePages.map((pageNumber) => (
              <button key={pageNumber} className={pageNumber === page ? 'primaryButton' : 'secondaryButton'} type="button" disabled={pageNumber === page} onClick={() => setPage(pageNumber)} style={{ width: '28px', height: '28px', padding: 0 }}>{pageNumber}</button>
            ))}
            {visiblePages.at(-1)! < totalPages ? <span>...</span> : null}
            <button className="iconButton" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} style={{ width: '28px', height: '28px' }}><ChevronRight size={16} /></button>
          </div>
        </div>

      </div>

      {drawerOpen && selectedRow && (
        <div className={styles.sidePanel}>
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitle}>{shortSku(selectedRow.displaySku)}</div>
            <button className="iconButton" style={{ border: 'none' }} onClick={() => setDrawerOpen(false)}>
              <X size={18} color="var(--muted)" />
            </button>
          </div>
          <div className={styles.drawerProductInfo}>
            <div className={styles.productImg}>
              <div className={styles.productImgPlaceholder}></div>
            </div>
            <div className={styles.productMeta}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>{selectedRow.productName}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                SKU: {selectedRow.displaySku} <Copy size={12} />
              </div>
            </div>
          </div>
          <div className={styles.drawerTabs}>
            {skuDrawerTabs.map((tab) => (
              <button className={`${styles.drawerTab} ${drawerTab === tab.value ? styles.active : ''}`} key={tab.value} type="button" onClick={() => setDrawerTab(tab.value)}>
                {tab.label}{tab.value === 'evidence' ? ` (${selectedRow.evidenceCount})` : ''}
              </button>
            ))}
          </div>
          <div className={styles.drawerContent}>
            {drawerTab === 'overview' ? <SkuOverviewPanel selectedRow={selectedRow} selectedDetail={selectedDetail} /> : null}
            {drawerTab === 'evidence' ? <SkuEvidencePanel selectedRow={selectedRow} selectedDetail={selectedDetail} /> : null}
            {drawerTab === 'raw' ? <SkuRawPanel selectedDetail={selectedDetail} /> : null}
            {drawerTab === 'history' ? <SkuHistoryPanel selectedRow={selectedRow} selectedDetail={selectedDetail} /> : null}

          </div>
          <div className={styles.drawerFooter}>
            <button className="secondaryButton" type="button" onClick={() => void createReview(selectedRow)} disabled={busy === selectedRow.skuProfileId}>生成 Review</button>
            <button className="primaryButton" type="button" onClick={() => void updateNextAction(selectedRow)} disabled={busy === `next:${selectedRow.skuProfileId}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>设置下一步 ∨</button>
          </div>
        </div>
      )}
    </div>
  )
}

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0.0%'
}

function SkuOverviewPanel({ selectedRow, selectedDetail }: { selectedRow: DashboardSkuListItemDto; selectedDetail: DashboardSkuReadinessDetailDto | null }) {
  return (
    <>
      <div className={styles.drawerPanel}>
        <div className={styles.drawerStatRow}>
          <span className={styles.drawerStatLabel}>当前结论</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {renderHealthTag(selectedRow.healthStatus, styles)}
            <span style={{ fontWeight: 500 }}>{selectedDetail?.statusSummary.conclusion ?? selectedRow.eligibilityLabel}</span>
          </div>
        </div>
        <div className={styles.drawerStatRow}>
          <span className={styles.drawerStatLabel}>结论时间</span>
          <span className={styles.drawerStatValue}>{new Date(selectedRow.updatedAt).toLocaleString('zh-CN')}</span>
        </div>
        <div className={styles.drawerStatRow}>
          <span className={styles.drawerStatLabel}>执行 Run</span>
          <span className={styles.drawerStatValue}>{selectedDetail?.relatedRules[0]?.label ?? '当前健康诊断'}</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <a href="/rule-library" style={{ color: 'var(--primary)' }}>查看规则</a>
          <a href="/run-console" style={{ color: 'var(--primary)' }}>查看 Run</a>
        </div>
      </div>

      <div className={styles.drawerPanel}>
        <div className={styles.drawerPanelTitle}>下一步建议</div>
        <div style={{ color: 'var(--ready)', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>{selectedDetail?.statusSummary.nextStep ?? selectedRow.nextAction.label}</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{selectedDetail?.latestDiagnosis?.nextActions.join('；') || selectedRow.nextAction.label}</div>
      </div>
    </>
  )
}

function SkuEvidencePanel({ selectedRow, selectedDetail }: { selectedRow: DashboardSkuListItemDto; selectedDetail: DashboardSkuReadinessDetailDto | null }) {
  return (
    <>
      <div className={styles.drawerPanel}>
        <div className={styles.drawerPanelTitle}>影响规则 <span style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: '12px', marginLeft: '8px' }}>(已通过 {selectedDetail?.evidenceOverview.dataCheckPassedCount ?? 0} / 共 {selectedDetail?.readinessChecklist.length ?? 0} 条)</span></div>
        <div className={styles.drawerStatRow}>
          <span className={styles.drawerStatLabel}>规则集</span>
          <span className={styles.drawerStatValue}>{selectedDetail?.relatedRules[0]?.label ?? '暂无关联规则'}</span>
        </div>
        <div className={styles.drawerStatRow}>
          <span className={styles.drawerStatLabel}>异常规则</span>
          <span className={styles.drawerStatValue}>{selectedDetail?.latestDiagnosis?.issues.length ?? 0} 条</span>
        </div>
      </div>

      <div className={styles.drawerPanel}>
        <div className={styles.drawerPanelTitle}>证据摘要 ({selectedRow.evidenceCount})</div>
        <div className={styles.drawerEvidenceList}>
          {(selectedDetail?.readinessChecklist ?? []).map((item) => (
            <div className={styles.drawerEvidenceItem} key={item.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--ready)" /> {item.label}</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span>{item.evidenceRefs.length} 条</span>
                <span>{checklistLabel(item.status)}</span>
                <a href={`/sku-health/${selectedRow.skuProfileId}`} style={{ color: 'var(--primary)' }}>查看</a>
              </div>
            </div>
          ))}
          {!selectedDetail?.readinessChecklist.length ? <div className={styles.emptyState}>当前 SKU 没有返回检查项。</div> : null}
        </div>
        <div style={{ fontSize: '13px', marginTop: '16px' }}>
          <a href={`/sku-health/${selectedRow.skuProfileId}`} style={{ color: 'var(--primary)' }}>查看全部证据</a>
        </div>
      </div>
    </>
  )
}

function SkuRawPanel({ selectedDetail }: { selectedDetail: DashboardSkuReadinessDetailDto | null }) {
  return (
    <div className={styles.drawerPanel}>
      <div className={styles.drawerPanelTitle}>原始字段</div>
      <pre className={styles.rawJson}>{JSON.stringify(selectedDetail?.latestSnapshot ?? selectedDetail?.keyMetrics ?? {}, null, 2)}</pre>
    </div>
  )
}

function SkuHistoryPanel({ selectedRow, selectedDetail }: { selectedRow: DashboardSkuListItemDto; selectedDetail: DashboardSkuReadinessDetailDto | null }) {
  return (
    <div className={styles.drawerPanel}>
      <div className={styles.drawerPanelTitle}>历史记录</div>
      <div className={styles.drawerEvidenceList}>
        <div className={styles.drawerEvidenceItem}><span>最近更新</span><span>{new Date(selectedRow.updatedAt).toLocaleString('zh-CN')}</span></div>
        {selectedDetail?.keyMetrics.collectedAt ? <div className={styles.drawerEvidenceItem}><span>最近采集</span><span>{new Date(selectedDetail.keyMetrics.collectedAt).toLocaleString('zh-CN')}</span></div> : null}
        {selectedDetail?.latestDiagnosis ? <div className={styles.drawerEvidenceItem}><span>最近诊断</span><span>{new Date(selectedDetail.latestDiagnosis.diagnosedAt).toLocaleString('zh-CN')}</span></div> : null}
        {selectedDetail?.relatedReviews.map((review) => (
          <div className={styles.drawerEvidenceItem} key={review.entityId}><span>{review.label}</span><span>{review.entityId}</span></div>
        ))}
      </div>
    </div>
  )
}

function shortSku(value: string): string {
  return value.split(':').at(-1) ?? value
}

function healthReason(status: DashboardSkuListItemDto['healthStatus']): string {
  if (status === 'READY') return '所有规则通过'
  if (status === 'BLOCKED') return '存在阻塞项'
  if (status === 'RISKY') return '风险需复核'
  return '存在可修复问题'
}

function checklistLabel(status: DashboardSkuReadinessDetailDto['readinessChecklist'][number]['status']): string {
  if (status === 'PASSED') return '通过'
  if (status === 'FAILED') return '失败'
  if (status === 'MANUAL_REVIEW') return '待确认'
  return '缺数据'
}

function paginationWindow(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function renderHealthTag(status: DashboardSkuListItemDto['healthStatus'], styleMap: typeof styles) {
  if (status === 'READY') return <span className={styleMap.tagReady}>通过</span>
  if (status === 'BLOCKED') return <span className={styleMap.tagBlocked}>不建议</span>
  if (status === 'RISKY') return <span className={styleMap.tagReview}>待确认</span>
  return <span className={styleMap.tagRepair}>可修复</span>
}

function exportRows(rows: DashboardSkuListItemDto[]) {
  const header = ['skuProfileId', 'displaySku', 'productName', 'category', 'healthStatus', 'eligibilityLabel', 'nextAction']
  const csv = [
    header.join(','),
    ...rows.map((row) => header.map((key) => JSON.stringify(key === 'nextAction' ? row.nextAction.label : row[key as keyof DashboardSkuListItemDto] ?? '')).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sku-access-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
