'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Wrench, HelpCircle, XCircle, Search, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DashboardSkuListItemDto, DashboardSkuReadinessDetailDto } from '../../../../contracts/types/dashboardSkuReadModels'
import type { EvidenceLinkDto, ReportPreviewDto, ReviewItemDto } from '../../../../contracts/types/businessFoundation'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi, type HealthSummaryDto, type PageDto } from './api-client'
import styles from './sku-access.module.css'

type SkuDrawerTab = 'overview' | 'evidence' | 'raw' | 'history'
type SkuNextAction = DashboardSkuListItemDto['nextAction']
interface SkuExportDto {
  fileName: string
  contentType: 'text/csv'
  csv: string
  rowCount: number
  artifactHref?: string
  artifactContentType?: 'text/csv'
  workflowRunId?: string
}
interface ActionLink {
  href: string
  label: string
}

const skuDrawerTabs: Array<{ value: SkuDrawerTab; label: string }> = [
  { value: 'overview', label: '概览' },
  { value: 'evidence', label: '证据' },
  { value: 'raw', label: '原始字段' },
  { value: 'history', label: '历史' },
]

const nextActionOptions: SkuNextAction[] = [
  { type: 'JOIN_ACTIVITY', label: '加入活动报名' },
  { type: 'REPAIR_ISSUE', label: '修复后再报名' },
  { type: 'MANUAL_REVIEW', label: '提交人工确认' },
  { type: 'VIEW_BLOCKER', label: '查看阻塞原因' },
  { type: 'VIEW_DETAIL', label: '查看 SKU 详情' },
]

export function SkuAccessPage() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [summary, setSummary] = useState<HealthSummaryDto | null>(null)
  const [skuPage, setSkuPage] = useState<PageDto<DashboardSkuListItemDto> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => getInitialSkuParam('skuProfileId'))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedDetail, setSelectedDetail] = useState<DashboardSkuReadinessDetailDto | null>(null)
  const [query, setQuery] = useState(() => getInitialSkuParam('q') ?? '')
  const [page, setPage] = useState(() => getInitialSkuPage())
  const [healthStatus, setHealthStatus] = useState<DashboardSkuListItemDto['healthStatus'] | 'ALL'>(() => getInitialHealthStatus())
  const [sourceKind, setSourceKind] = useState(() => getInitialSkuParam('sourceKind') ?? 'ALL')
  const [category, setCategory] = useState(() => getInitialSkuParam('category') ?? 'ALL')
  const [drawerTab, setDrawerTab] = useState<SkuDrawerTab>(() => getInitialDrawerTab())
  const [nextActionType, setNextActionType] = useState<SkuNextAction['type']>('MANUAL_REVIEW')
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<ActionLink | null>(null)
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
    if (sourceKind !== 'ALL') params.set('sourceKind', sourceKind)
    if (category !== 'ALL') params.set('category', category)
    if (query.trim()) params.set('q', query.trim())
    Promise.all([
      fetchActivityApi<HealthSummaryDto>('/api/health/summary'),
      fetchActivityApi<PageDto<DashboardSkuListItemDto>>(`/api/skus?${params.toString()}`),
    ])
      .then(([nextSummary, nextSkuPage]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setSkuPage(nextSkuPage)
        setSelectedId((current) => current ?? nextSkuPage.items[0]?.skuProfileId ?? null)
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
  }, [page, healthStatus, sourceKind, category, query])

  useEffect(() => {
    syncSkuUrl({ skuProfileId: selectedId, page, healthStatus, sourceKind, category, query, drawerTab })
  }, [selectedId, page, healthStatus, sourceKind, category, query, drawerTab])

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

  const rows = useMemo(() => skuPage?.items ?? [], [skuPage])
  const sourceOptions = useMemo(() => uniqueOptions(rows.map((item) => item.sourceKind), sourceKind), [rows, sourceKind])
  const categoryOptions = useMemo(() => uniqueOptions(rows.map((item) => item.category), category), [rows, category])
  const selectedRow = rows.find((item) => item.skuProfileId === selectedId) ?? rows[0]
  const selectedRows = rows.filter((item) => selectedIds.includes(item.skuProfileId))
  const allVisibleSelected = rows.length > 0 && rows.every((item) => selectedIds.includes(item.skuProfileId))
  const totalPages = Math.max(1, Math.ceil((skuPage?.total ?? 0) / (skuPage?.pageSize ?? 20)))
  const visiblePages = paginationWindow(page, totalPages)
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/sku-access',
    pageTitle: 'SKU 准入工作台',
    selectedEntity: {
      entityType: 'sku',
      entityId: selectedRow?.skuProfileId ?? selectedId ?? 'sku-access',
      label: selectedRow?.displaySku ?? selectedRow?.productName ?? 'SKU 准入工作台',
    },
    visibleFilters: { page, healthStatus, sourceKind, category, query, drawerTab, selectedIds },
    visibleColumns: ['displaySku', 'productName', 'healthStatus', 'eligibilityLabel', 'nextAction'],
  }), [category, drawerTab, healthStatus, page, query, selectedId, selectedIds, selectedRow?.displaySku, selectedRow?.productName, selectedRow?.skuProfileId, sourceKind])
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
    setActionLink(null)
    try {
      const details = await Promise.all(items.map((item) => fetchActivityApi<DashboardSkuReadinessDetailDto>(`/api/skus/${item.skuProfileId}`)))
      const created = await fetchActivityApi<ReviewItemDto[]>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((item) => {
            const detail = details.find((candidate) => candidate.skuProfileId === item.skuProfileId)
            const evidence = detail ? reviewEvidenceFromSkuDetail(detail) : []
            return {
              skuProfileId: item.skuProfileId,
              sourceType: 'health',
              sourceId: detail?.latestDiagnosis?.diagnosisId ?? detail?.latestSnapshot?.snapshotId ?? item.skuProfileId,
              question: `确认 ${item.displaySku} 的活动准入下一步`,
              recommendation: detail?.statusSummary.nextStep ?? item.nextAction.label,
              riskLevel: item.healthStatus === 'BLOCKED' || item.healthStatus === 'RISKY' ? 'L2' : 'L1',
              evidence: evidence.length ? evidence : [
                {
                  type: 'snapshot',
                  entityId: item.skuProfileId,
                  label: item.productName,
                  summary: item.eligibilityLabel,
                },
              ],
            }
          }),
        }),
      })
      setMessage(`已生成 Review：${created.map((item) => item.reviewItemId).join(', ')}`)
      if (created[0]) {
        setActionLink({
          href: reviewApprovalHref(created[0].reviewItemId),
          label: created.length > 1 ? `查看首个 Review（共 ${created.length} 个）` : '查看 Review',
        })
      }
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
    const nextAction = nextActionOptions.find((option) => option.type === nextActionType) ?? nextActionOptions[0]
    if (items.length > 1) {
      setBusy('bulk-next')
      setActionLink(null)
      try {
        const details = await Promise.all(items.map((item) => fetchActivityApi<DashboardSkuReadinessDetailDto>(`/api/skus/${item.skuProfileId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nextAction,
            comment: `sku-access-page-bulk:${nextAction.type}`,
          }),
        })))
        const updatedIds = new Set(items.map((item) => item.skuProfileId))
        setSkuPage((current) => current ? {
          ...current,
          items: current.items.map((row) => updatedIds.has(row.skuProfileId) ? { ...row, nextAction } : row),
        } : current)
        const selected = details.find((detail) => detail.skuProfileId === selectedId)
        if (selected) setSelectedDetail(selected)
        setMessage(`已批量设置下一步为「${nextAction.label}」：${items.length} 个 SKU`)
        const firstRunId = details.find((detail) => detail.workflowRunId)?.workflowRunId
        setActionLink(firstRunId ? { href: runConsoleHref(firstRunId), label: `查看首个设置 Run（共 ${items.length} 个）` } : null)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '批量设置下一步失败')
      } finally {
        setBusy(null)
      }
      return
    }
    const item = items[0]
    setBusy(`next:${item.skuProfileId}`)
    setActionLink(null)
    try {
      const detail = await fetchActivityApi<DashboardSkuReadinessDetailDto>(`/api/skus/${item.skuProfileId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nextAction,
          comment: `sku-access-page:${nextAction.type}`,
        }),
      })
      setSelectedDetail(detail)
      setSkuPage((current) => current ? {
        ...current,
        items: current.items.map((row) => row.skuProfileId === item.skuProfileId ? { ...row, nextAction } : row),
      } : current)
      setMessage(`已设置下一步：${detail.statusSummary.nextStep}`)
      setActionLink(detail.workflowRunId ? { href: runConsoleHref(detail.workflowRunId), label: '查看设置 Run' } : null)
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
    setActionLink(null)
    try {
      const report = await fetchActivityApi<ReportPreviewDto>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          type: 'HEALTH',
          skuProfileIds,
        }),
      })
      setMessage(`已生成健康报告：${report.reportId}`)
      setActionLink({
        href: report.workflowRunId ? runConsoleHref(report.workflowRunId) : reportCenterHref(report.reportId),
        label: report.workflowRunId ? '查看生成 Run' : '查看健康报告',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成健康报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function exportCurrentRows() {
    setBusy('export')
    setActionLink(null)
    try {
      const exported = await fetchActivityApi<SkuExportDto>('/api/skus/export', {
        method: 'POST',
        body: JSON.stringify({
          query: {
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            q: query.trim() || undefined,
            healthStatus: healthStatus === 'ALL' ? undefined : healthStatus,
            sourceKind: sourceKind === 'ALL' ? undefined : sourceKind,
            category: category === 'ALL' ? undefined : category,
          },
        }),
      })
      downloadCsv(exported)
      setMessage(`已导出 SKU 当前筛选结果：${exported.rowCount} 行${exported.workflowRunId ? ` / Run ${exported.workflowRunId}` : ''}`)
      setActionLink(exported.artifactHref ? { href: exported.artifactHref, label: '下载导出文件' } : exported.workflowRunId ? { href: runConsoleHref(exported.workflowRunId), label: '查看导出 Run' } : null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出 SKU 失败')
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
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className={styles.layout}>
      <div className={styles.mainArea}>
        <div className="pageHeader">
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>SKU 准入工作台</h1>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>按 SKU 维度查看准入状态、核心原因与下一步建议，可批量处理并生成 Review。</p>
            {message ? (
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>
                {message}
                {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            数据源
            <select className={styles.filterSelect} value={sourceKind} onChange={(event) => { setSourceKind(event.target.value); setPage(1) }}>
              <option value="ALL">全部</option>
              {sourceOptions.map((item) => <option value={item} key={item}>{sourceKindLabel(item)}</option>)}
            </select>
          </div>
          <div className={styles.filterItem}>
            类目
            <select className={styles.filterSelect} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}>
              <option value="ALL">全部</option>
              {categoryOptions.map((item) => <option value={item} key={item}>{item}</option>)}
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
            <input type="text" placeholder="搜索 SKU / 商品名 / SPU" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
          </div>
          <button className="secondaryButton" type="button" onClick={() => { setQuery(''); setHealthStatus('ALL'); setSourceKind('ALL'); setCategory('ALL'); setPage(1) }} style={{ height: '32px' }}>重置</button>
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
            <select className="secondaryButton" value={nextActionType} onChange={(event) => setNextActionType(event.target.value as SkuNextAction['type'])} style={{ height: '32px', fontSize: '13px', width: '128px' }} aria-label="下一步动作">
              {nextActionOptions.map((option) => <option value={option.type} key={option.type}>{option.label}</option>)}
            </select>
            <button className="secondaryButton" type="button" onClick={() => void updateNextActions(selectedRows)} disabled={!selectedRows.length || !!busy} style={{ height: '32px', fontSize: '13px' }}>批量设置下一步</button>
            <button className="secondaryButton" type="button" onClick={() => void exportCurrentRows()} disabled={busy === 'export'} style={{ height: '32px', fontSize: '13px' }}>导出当前结果</button>
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
              <tr key={item.skuProfileId} className={selectedId === item.skuProfileId ? styles.rowActive : undefined} onClick={() => { setSelectedId(item.skuProfileId); setDrawerOpen(true); syncSkuUrl({ skuProfileId: item.skuProfileId, page, healthStatus, sourceKind, category, query, drawerTab }) }}>
                <td><input type="checkbox" checked={selectedIds.includes(item.skuProfileId)} onChange={(event) => { event.stopPropagation(); toggleRowSelection(item.skuProfileId) }} onClick={(event) => event.stopPropagation()} /></td>
                <td>{shortSku(item.displaySku)}</td>
                <td className={styles.productCell}>
                  <span className={styles.productName}>{item.productName}</span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{item.category ?? '-'}</td>
                <td>{renderHealthTag(item.healthStatus, styles)}</td>
                <td>{item.eligibilityLabel === '未模拟' ? healthReason(item.healthStatus) : item.eligibilityLabel}</td>
                <td>{item.nextAction.label}</td>
                <td><a href={skuAccessEvidenceHref(item.skuProfileId)} onClick={(event) => event.stopPropagation()} style={{ color: 'var(--primary)' }}>查看证据 ({item.evidenceCount})</a></td>
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
              <button className={`${styles.drawerTab} ${drawerTab === tab.value ? styles.active : ''}`} key={tab.value} type="button" onClick={() => { setDrawerTab(tab.value); syncSkuUrl({ skuProfileId: selectedRow.skuProfileId, page, healthStatus, sourceKind, category, query, drawerTab: tab.value }) }}>
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
            <button className="primaryButton" type="button" onClick={() => void updateNextAction(selectedRow)} disabled={busy === `next:${selectedRow.skuProfileId}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>设为{(nextActionOptions.find((option) => option.type === nextActionType) ?? nextActionOptions[0]).label}</button>
          </div>
        </div>
      )}
    </div>
    </>
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
                <a href={skuAccessEvidenceHref(selectedRow.skuProfileId)} style={{ color: 'var(--primary)' }}>查看</a>
              </div>
            </div>
          ))}
          {!selectedDetail?.readinessChecklist.length ? <div className={styles.emptyState}>当前 SKU 没有返回检查项。</div> : null}
        </div>
        <div style={{ fontSize: '13px', marginTop: '16px' }}>
          <a href={skuAccessEvidenceHref(selectedRow.skuProfileId)} style={{ color: 'var(--primary)' }}>查看全部证据</a>
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

function uniqueOptions(values: Array<string | undefined>, selected: string): string[] {
  const options = Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((left, right) => left.localeCompare(right))
  if (selected !== 'ALL' && !options.includes(selected)) return [selected, ...options]
  return options
}

function sourceKindLabel(value: string): string {
  if (value === 'browser_extension') return '浏览器插件'
  if (value === 'platform_api') return '平台 API'
  if (value === 'report_import') return '报表导入'
  return value
}

function reviewEvidenceFromSkuDetail(detail: DashboardSkuReadinessDetailDto): EvidenceLinkDto[] {
  const refs = [
    ...(detail.latestDiagnosis?.evidenceRefs ?? []),
    ...detail.readinessChecklist.flatMap((item) => item.evidenceRefs),
  ]
  const seen = new Set<string>()
  return refs.flatMap((ref) => {
    const entityId = ref.entityId || ref.sourceId
    if (!entityId) return []
    const key = `${ref.sourceType}:${entityId}:${ref.label}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{
      type: evidenceTypeFromSource(ref.sourceType),
      entityId,
      label: ref.label,
      summary: ref.evidenceText ?? ref.field ?? ref.label,
    }]
  })
}

function evidenceTypeFromSource(sourceType: DashboardSkuReadinessDetailDto['readinessChecklist'][number]['evidenceRefs'][number]['sourceType']): EvidenceLinkDto['type'] {
  if (sourceType === 'sku_snapshot') return 'snapshot'
  if (sourceType === 'health_diagnosis') return 'diagnosis'
  if (sourceType === 'rule_set') return 'rule'
  if (sourceType === 'simulation_run' || sourceType === 'simulation_result') return 'simulation'
  if (sourceType === 'review_item') return 'review'
  if (sourceType === 'report') return 'report'
  return 'tool_trace'
}

function renderHealthTag(status: DashboardSkuListItemDto['healthStatus'], styleMap: typeof styles) {
  if (status === 'READY') return <span className={styleMap.tagReady}>通过</span>
  if (status === 'BLOCKED') return <span className={styleMap.tagBlocked}>不建议</span>
  if (status === 'RISKY') return <span className={styleMap.tagReview}>待确认</span>
  return <span className={styleMap.tagRepair}>可修复</span>
}

function downloadCsv(exported: SkuExportDto) {
  const blob = new Blob([exported.csv], { type: `${exported.contentType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exported.fileName
  link.click()
  URL.revokeObjectURL(url)
}

function getInitialSkuParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function getInitialSkuPage(): number {
  const value = Number(getInitialSkuParam('page') ?? 1)
  return Number.isInteger(value) && value > 0 ? value : 1
}

function getInitialHealthStatus(): DashboardSkuListItemDto['healthStatus'] | 'ALL' {
  const value = getInitialSkuParam('healthStatus')
  return value === 'READY' || value === 'REPAIRABLE' || value === 'RISKY' || value === 'BLOCKED' ? value : 'ALL'
}

function getInitialDrawerTab(): SkuDrawerTab {
  const value = getInitialSkuParam('drawerTab')
  return value === 'overview' || value === 'evidence' || value === 'raw' || value === 'history' ? value : 'overview'
}

function skuAccessEvidenceHref(skuProfileId: string): string {
  const params = new URLSearchParams({ skuProfileId, drawerTab: 'evidence' })
  return `/sku-access?${params.toString()}`
}

function reviewApprovalHref(reviewItemId: string): string {
  const params = new URLSearchParams({ reviewItemId })
  return `/review-approvals?${params.toString()}`
}

function reportCenterHref(reportId: string): string {
  const params = new URLSearchParams({ reportId })
  return `/report-center?${params.toString()}`
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function syncSkuUrl(state: {
  skuProfileId: string | null
  page: number
  healthStatus: DashboardSkuListItemDto['healthStatus'] | 'ALL'
  sourceKind: string
  category: string
  query: string
  drawerTab: SkuDrawerTab
}) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (state.skuProfileId) params.set('skuProfileId', state.skuProfileId)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.healthStatus !== 'ALL') params.set('healthStatus', state.healthStatus)
  if (state.sourceKind !== 'ALL') params.set('sourceKind', state.sourceKind)
  if (state.category !== 'ALL') params.set('category', state.category)
  if (state.query.trim()) params.set('q', state.query.trim())
  if (state.drawerTab !== 'overview') params.set('drawerTab', state.drawerTab)
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}
