'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, ChevronRight, Download, FileText, Plus, RefreshCw } from 'lucide-react'
import type { ReportPreviewDto } from '../../../../contracts/types/businessFoundation'
import type { DashboardSkuListItemDto } from '../../../../contracts/types/dashboardSkuReadModels'
import type { ReportComparisonDto, ReportDetailDto, ReportExportJobDto, ReportListItemDto, ReportSubscriptionDto, ReportVersionDto } from '../../../../contracts/types/reviewReportCenter'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './report-center.module.css'

type ExportFormat = 'PDF' | 'EXCEL' | 'PPT'
type ReportTab = ReportDetailDto['tabs'][number]
type SubscriptionFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'OFF'
interface ActionLink {
  href: string
  label: string
}

const tabLabels: Record<ReportTab, string> = {
  SUMMARY: '执行摘要',
  TASKS: '任务明细',
  RULES: '规则明细',
  EVIDENCE: '证据详情',
  REPAIRS: '修复记录',
}

export function ReportCenterPage() {
  const [reports, setReports] = useState<ReportListItemDto[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReportDetailDto | null>(null)
  const [versions, setVersions] = useState<ReportVersionDto[]>([])
  const [comparison, setComparison] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ReportTab>(() => getInitialReportTab())
  const [format, setFormat] = useState<ExportFormat>('PDF')
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeDetails, setIncludeDetails] = useState(false)
  const [subscriptionFrequency, setSubscriptionFrequency] = useState<SubscriptionFrequency>('WEEKLY')
  const [subscriptionRecipients, setSubscriptionRecipients] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<ActionLink | null>(null)
  const [secondaryActionLink, setSecondaryActionLink] = useState<ActionLink | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const hydratedSelectionRef = useRef<{ reportId: string; versionId: string | null } | null>(null)

  async function loadReports(preferredId?: string | null, preferredVersionId?: string | null) {
    const page = await fetchActivityApi<PageDto<ReportListItemDto>>('/api/reports')
    const list = page.items
    setReports(list)
    const initialReportId = getInitialReportId()
    const initialVersionId = getInitialVersionId()
    const nextId = preferredId ?? initialReportId ?? selectedReportId ?? list[0]?.reportId ?? null
    setSelectedReportId(nextId)
    if (nextId) await loadReportDetail(nextId, preferredVersionId ?? (nextId === initialReportId ? initialVersionId : selectedVersionId))
  }

  useEffect(() => {
    loadReports().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '报告 API 加载失败'))
  }, [])

  useEffect(() => {
    if (!selectedReportId) return
    if (hydratedSelectionRef.current?.reportId === selectedReportId) return
    loadReportDetail(selectedReportId)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '报告详情加载失败'))
  }, [selectedReportId])

  useEffect(() => {
    if (!detail) return
    syncReportUrl(detail.reportId, selectedVersionId, activeTab)
  }, [activeTab, detail?.reportId, selectedVersionId])

  async function loadReportDetail(reportId: string, preferredVersionId?: string | null) {
    const [nextDetail, versionPage] = await Promise.all([
      fetchActivityApi<ReportDetailDto>(`/api/reports/${reportId}`),
      fetchActivityApi<PageDto<ReportVersionDto>>(`/api/reports/${reportId}/versions`),
    ])
    const nextVersions = versionPage.items
    const nextVersion = nextVersions.find((item) => item.versionId === preferredVersionId) ?? nextVersions[0] ?? null
    setVersions(nextVersions)
    setSelectedVersionId(nextVersion?.versionId ?? null)
    setDetail(nextVersion ?? nextDetail)
    hydratedSelectionRef.current = { reportId, versionId: nextVersion?.versionId ?? null }
    setSubscriptionFrequency(nextDetail.subscription?.frequency ?? 'OFF')
    setSubscriptionRecipients(nextDetail.subscription?.recipients.join('\n') ?? '')
    setActiveTab((current) => (nextDetail.tabs.includes(current) ? current : nextDetail.tabs[0] ?? 'SUMMARY'))
  }

  function switchVersion(versionId: string) {
    const version = versions.find((item) => item.versionId === versionId)
    if (!version) return
    setSelectedVersionId(versionId)
    setDetail(version)
    hydratedSelectionRef.current = { reportId: version.reportId, versionId }
    syncReportUrl(version.reportId, versionId, activeTab)
    setMessage(`已切换报告版本：${version.version}`)
    setActionLink(null)
    setSecondaryActionLink(null)
  }

  function cycleVersion() {
    if (!versions.length) {
      setMessage('当前报告暂无可切换版本')
      return
    }
    const currentIndex = Math.max(0, versions.findIndex((item) => item.versionId === selectedVersionId))
    const next = versions[(currentIndex + 1) % versions.length]
    if (next) switchVersion(next.versionId)
  }

  const selectedSummary = reports.find((report) => report.reportId === selectedReportId)
  const comparisonBaseReportId = selectedReportId ?? reports[0]?.reportId ?? null
  const comparisonTargetReportId = reports.find((report) => report.reportId !== comparisonBaseReportId)?.reportId ?? null
  const totalSku = detail?.summary.totalSku ?? 0
  const passRate = totalSku > 0 ? ((detail?.summary.passedSku ?? 0) / totalSku) * 100 : 0

  async function exportReport() {
    if (!detail) return
    setBusy('export')
    setActionLink(null)
    setSecondaryActionLink(null)
    try {
      const job = await fetchActivityApi<ReportExportJobDto>(`/api/reports/${detail.reportId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format, includeCharts, includeDetails, idempotencyKey: `${detail.reportId}:${format}:${includeCharts}:${includeDetails}:${Date.now()}` }),
      })
      setMessage(`已生成导出文件：${job.exportJobId} / ${job.status} / 图表 ${job.includeCharts ? '包含' : '不包含'} / 明细 ${job.includeDetails ? '包含' : '不包含'}`)
      setActionLink({
        href: job.artifactHref,
        label: '下载导出文件',
      })
      setSecondaryActionLink(job.workflowRunId ? { href: runConsoleHref(job.workflowRunId), label: '查看导出 Run' } : null)
      await loadReports(detail.reportId, selectedVersionId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function subscribeReport() {
    if (!detail) return
    const recipients = parseRecipients(subscriptionRecipients)
    if (subscriptionFrequency !== 'OFF' && !recipients.length) {
      setMessage('订阅收件人不能为空；如需关闭订阅请选择 OFF')
      return
    }
    setBusy('subscribe')
    setActionLink(null)
    setSecondaryActionLink(null)
    try {
      const subscription = await fetchActivityApi<ReportSubscriptionDto>(`/api/reports/${detail.reportId}/subscriptions`, {
        method: 'POST',
        body: JSON.stringify({ frequency: subscriptionFrequency, recipients }),
      })
      setMessage(`已更新订阅：${subscription.frequency} / ${subscription.recipients.join(', ')}`)
      setActionLink({
        href: subscription.workflowRunId ? runConsoleHref(subscription.workflowRunId) : reportCenterHref(subscription.reportId, selectedVersionId, activeTab),
        label: subscription.workflowRunId ? '查看订阅 Run' : '查看报告',
      })
      setDetail((current) => current && current.reportId === subscription.reportId ? { ...current, subscription } : current)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订阅报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function copyReportLink() {
    if (!detail) return
    const params = new URLSearchParams({ reportId: detail.reportId })
    if (selectedVersionId) params.set('versionId', selectedVersionId)
    if (activeTab !== 'SUMMARY') params.set('tab', activeTab)
    const link = `${window.location.origin}/report-center?${params.toString()}`
    try {
      await copyText(link)
      setMessage(`已复制报告链接：${detail.reportId}${selectedVersionId ? ` / ${selectedVersionId}` : ''}`)
      setActionLink(null)
      setSecondaryActionLink(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '复制报告链接失败')
      setActionLink({ href: link, label: '打开报告链接' })
      setSecondaryActionLink(null)
    }
  }

  async function compareReports() {
    if (reports.length < 2) {
      setMessage('至少需要两个报告才能对比')
      return
    }
    const baseId = comparisonBaseReportId
    const targetId = comparisonTargetReportId
    if (!baseId) {
      setMessage('未找到可对比的基准报告')
      return
    }
    if (!targetId) {
      setMessage('未找到可对比的第二份报告')
      return
    }
    setBusy('compare')
    setActionLink(null)
    setSecondaryActionLink(null)
    try {
      const result = await fetchActivityApi<ReportComparisonDto>('/api/reports/compare', {
        method: 'POST',
        body: JSON.stringify({ baseReportId: baseId, targetReportId: targetId }),
      })
      setComparison(result.summary)
      setMessage(`已生成报告对比：${result.baseReportId} / ${result.targetReportId}`)
      setActionLink({
        href: result.workflowRunId ? runConsoleHref(result.workflowRunId) : reportCenterHref(result.baseReportId, null, 'SUMMARY'),
        label: result.workflowRunId ? '查看对比 Run' : '查看基准报告',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '对比报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function generateCurrentHealthReport() {
    setBusy('generate')
    setActionLink(null)
    setSecondaryActionLink(null)
    try {
      const skuRows = await loadAllReportSkuRows()
      const skuProfileIds = skuRows.map((item) => item.skuProfileId)
      if (!skuProfileIds.length) throw new Error('当前没有可用于生成报告的 SKU 数据')
      const report = await fetchActivityApi<ReportPreviewDto>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          type: 'HEALTH',
          skuProfileIds,
        }),
      })
      setMessage(`已基于当前 SKU 数据生成健康报告：${report.reportId}`)
      setActionLink({ href: reportCenterHref(report.reportId, null, 'SUMMARY'), label: '查看新报告' })
      setSecondaryActionLink(report.workflowRunId ? { href: runConsoleHref(report.workflowRunId), label: '查看生成 Run' } : null)
      await loadReports(report.reportId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '生成报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function loadAllReportSkuRows() {
    const firstPage = await fetchActivityApi<PageDto<DashboardSkuListItemDto>>('/api/skus?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc')
    const pageSize = firstPage.pageSize || 100
    const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize))
    if (totalPages <= 1) return firstPage.items
    const restPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => {
      const nextPage = index + 2
      return fetchActivityApi<PageDto<DashboardSkuListItemDto>>(`/api/skus?page=${nextPage}&pageSize=${pageSize}&sortBy=updatedAt&sortOrder=desc`)
    }))
    return [...firstPage.items, ...restPages.flatMap((page) => page.items)]
  }

  const reviewStats = detail?.summary.reviewResult
  const categoryRows = detail?.summary.categoryDistribution ?? []
  const riskRows = detail?.summary.majorRisks ?? []
  const repairRows = detail?.summary.repairSuggestions ?? []
  const visibleTabs: ReportTab[] = detail?.tabs.length ? detail.tabs : ['SUMMARY']
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/report-center',
    pageTitle: '报告中心',
    selectedEntity: {
      entityType: 'report',
      entityId: detail?.reportId ?? selectedReportId ?? 'report-center',
      label: detail?.title ?? selectedSummary?.title ?? '报告中心',
    },
    visibleFilters: {
      selectedVersionId,
      comparisonBaseReportId,
      comparisonTargetReportId,
      activeTab,
      format,
      includeCharts,
      includeDetails,
      subscriptionFrequency,
      subscriptionRecipientsDraft: subscriptionRecipients,
    },
    visibleColumns: ['section', 'summary', 'risk', 'repairSuggestion', 'version'],
  }), [activeTab, comparisonBaseReportId, comparisonTargetReportId, detail?.reportId, detail?.title, format, includeCharts, includeDetails, selectedReportId, selectedSummary?.title, selectedVersionId, subscriptionFrequency, subscriptionRecipients])

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.topBarTitle}>报告中心</div>
          <div className={styles.topBarSub}>查看任务执行结果与合规状态，识别风险并跟踪修复进展。</div>
          {message ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>
              {message}
              {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
              {secondaryActionLink ? <> · <a href={secondaryActionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{secondaryActionLink.label}</a></> : null}
            </div>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button className={styles.btnAction} type="button" onClick={() => void loadReports(selectedReportId)}><RefreshCw size={14} /> 刷新</button>
          <button className={styles.btnAction} type="button" onClick={() => void generateCurrentHealthReport()} disabled={busy === 'generate'}><Plus size={14} /> 生成报告</button>
          <button className={styles.btnAction} type="button" onClick={() => void subscribeReport()} disabled={!detail || busy === 'subscribe'}><Bell size={14} /> 订阅报告</button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`} type="button" onClick={() => void exportReport()} disabled={!detail || busy === 'export'}><Download size={14} /> 导出报告 <ChevronDown size={14} /></button>
        </div>
      </div>

      <div className={styles.mainBody}>
        <div className={styles.reportListPanel}>
          <div className={styles.listHeader}>
            报告列表
            <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>全部活动 <ChevronDown size={12} /></span>
          </div>

          {reports.map((report, index) => (
            <button className={`${styles.reportItem} ${report.reportId === selectedReportId ? styles.active : ''}`} key={report.reportId} type="button" onClick={() => { setSelectedReportId(report.reportId); syncReportUrl(report.reportId, null, activeTab) }}>
              <div className={styles.itemTitle}>{report.title} {index === 0 ? <span className={styles.itemBadge}>最新</span> : null} {report.reportId === selectedReportId ? <Check size={16} color="var(--primary)" style={{ marginLeft: 'auto' }} /> : null}</div>
              <div className={styles.itemMeta}>{report.version} &nbsp;&nbsp; {new Date(report.generatedAt).toLocaleString('zh-CN')}</div>
            </button>
          ))}

          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
            <button className="secondaryButton" type="button" onClick={() => void compareReports()} disabled={busy === 'compare' || reports.length < 2} style={{ width: '100%' }}>+ 对比报告</button>
          </div>
        </div>

        <div className={styles.centerPanel}>
          <div className={styles.centerHeader}>
            <div className={styles.reportTitleRow}>
              <div className={styles.reportTitle}>{detail?.title ?? '请选择报告'} <span className={styles.tagCompleted}>{detail?.status ?? '-'}</span></div>
              <div style={{ color: 'var(--primary)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>展开 <ChevronDown size={14} /></div>
            </div>
            <div className={styles.reportMetaText}>
              <span>版本 {detail?.version ?? '-'}</span>
              <span>执行任务 {detail?.sourceRun?.entityId ?? '-'}</span>
              <span>生成时间 {detail?.generatedAt ? new Date(detail.generatedAt).toLocaleString('zh-CN') : '-'}</span>
              <span>活动时间 {detail?.activityWindow ? `${detail.activityWindow.startAt} ~ ${detail.activityWindow.endAt}` : '-'}</span>
            </div>
          </div>

          <div className={styles.centerTabs}>
            {visibleTabs.map((tab) => (
              <button className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`} key={tab} type="button" onClick={() => { setActiveTab(tab); if (detail) syncReportUrl(detail.reportId, selectedVersionId, tab) }}>
                {tabLabels[tab]}
              </button>
            ))}
          </div>

          <div className={styles.centerBody}>
            {comparison ? (
              <section>
                <div className={styles.sectionTitle}>报告对比</div>
                <div className={styles.reviewSection}>
                  <span>{comparison}</span>
                  <button className="secondaryButton" type="button" onClick={() => setComparison(null)} style={{ height: '28px', fontSize: '12px' }}>关闭</button>
                </div>
              </section>
            ) : null}

            {activeTab === 'SUMMARY' ? (
              <ReportSummaryTab detail={detail} totalSku={totalSku} passRate={passRate} categoryRows={categoryRows} riskRows={riskRows} reviewStats={reviewStats} />
            ) : null}
            {activeTab === 'TASKS' ? <ReportTasksTab detail={detail} /> : null}
            {activeTab === 'RULES' ? <ReportRulesTab detail={detail} /> : null}
            {activeTab === 'EVIDENCE' ? <ReportEvidenceTab detail={detail} /> : null}
            {activeTab === 'REPAIRS' ? <ReportRepairsTab repairRows={repairRows} /> : null}
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>报告版本</div>
            <div className={styles.versionSelect}><div><div style={{ fontWeight: 500 }}>{detail?.version ?? '-'}</div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>{detail?.generatedAt ? new Date(detail.generatedAt).toLocaleString('zh-CN') : '-'}</div></div><ChevronDown size={14} color="var(--muted)" /></div>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
              {versions.map((version) => (
                <button className="secondaryButton" type="button" key={version.versionId} onClick={() => switchVersion(version.versionId)} disabled={version.versionId === selectedVersionId} style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span>{version.version}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{new Date(version.generatedAt).toLocaleString('zh-CN')}</span>
                </button>
              ))}
            </div>
            <button className="secondaryButton" type="button" onClick={cycleVersion} disabled={versions.length <= 1} style={{ width: '100%' }}>切换版本</button>
          </div>

          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>导出报告</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>选择格式</div>
            <div className={styles.exportFormatGrid}>
              {(['PDF', 'EXCEL', 'PPT'] as ExportFormat[]).map((item) => <button className={`${styles.formatBtn} ${format === item ? styles.active : ''}`} type="button" key={item} onClick={() => setFormat(item)}>{item}</button>)}
            </div>
            <label className={styles.checkboxItem}><input type="checkbox" checked={includeCharts} onChange={(event) => setIncludeCharts(event.target.checked)} /><span>包含图表与摘要 <span style={{ color: 'var(--primary)', fontSize: '12px' }}>(推荐)</span></span></label>
            <label className={styles.checkboxItem} style={{ marginBottom: '24px' }}><input type="checkbox" checked={includeDetails} onChange={(event) => setIncludeDetails(event.target.checked)} /><span>包含明细数据</span></label>
            <button className="primaryButton" type="button" onClick={() => void exportReport()} disabled={!detail || busy === 'export'} style={{ width: '100%' }}>导出</button>
          </div>

          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>报告信息</div>
            <InfoRow label="报告 ID" value={detail?.reportId ?? selectedSummary?.reportId ?? '-'} />
            <InfoRow label="生成方式" value="自动生成" />
            <InfoRow label="数据来源" value={detail?.sourceRun?.label ?? '-'} />
            <InfoRow label="规则版本" value={detail?.version ?? '-'} />
            <InfoRow label="导出状态" value={selectedSummary?.exportStatus ?? '-'} />
            <button className="secondaryButton" type="button" onClick={() => void copyReportLink()} disabled={!detail} style={{ width: '100%', marginTop: '12px' }}><FileText size={14} /> 复制报告链接</button>
          </div>

          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>订阅设置</div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>设置定期发送报告到邮箱或群组。</div>
            <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              发送频率
              <select className="secondaryButton" value={subscriptionFrequency} onChange={(event) => setSubscriptionFrequency(event.target.value as SubscriptionFrequency)} style={{ width: '100%', justifyContent: 'space-between' }}>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="OFF">OFF</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              收件人
              <textarea
                value={subscriptionRecipients}
                onChange={(event) => setSubscriptionRecipients(event.target.value)}
                placeholder="多个邮箱用逗号或换行分隔"
                rows={3}
                style={{ width: '100%', resize: 'vertical', border: '1px solid var(--line)', borderRadius: '6px', padding: '8px', font: 'inherit', color: 'var(--fg)' }}
              />
            </label>
            <button className="secondaryButton" type="button" onClick={() => void subscribeReport()} disabled={!detail || busy === 'subscribe'} style={{ width: '100%' }}>去订阅</button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

function StatCard({ label, value, small }: { label: string; value: number; small?: string }) {
  return <div className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value} {small ? <small>{small}</small> : null}</div><div className={styles.statChange}>来自 Report DTO</div></div>
}

function ReportSummaryTab({ detail, totalSku, passRate, categoryRows, riskRows, reviewStats }: {
  detail: ReportDetailDto | null
  totalSku: number
  passRate: number
  categoryRows: NonNullable<ReportDetailDto['summary']['categoryDistribution']>
  riskRows: NonNullable<ReportDetailDto['summary']['majorRisks']>
  reviewStats: ReportDetailDto['summary']['reviewResult'] | undefined
}) {
  return (
    <>
      <section>
        <div className={styles.sectionTitle}>活动概览</div>
        <div className={styles.overviewGrid}>
          <StatCard label="涉及活动 SKU" value={totalSku} />
          <StatCard label="通过 SKU" value={detail?.summary.passedSku ?? 0} small={`${passRate.toFixed(1)}%`} />
          <StatCard label="待修复 SKU" value={detail?.summary.repairableSku ?? 0} />
          <StatCard label="阻断 SKU" value={detail?.summary.blockedSku ?? 0} />
        </div>
      </section>

      <section>
        <div className={styles.donutSection}>
          <div style={{ flex: 1 }}>
            <div className={styles.sectionTitle}>SKU 准入结果</div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div className={styles.donutChart}><span style={{ fontSize: '24px', fontWeight: 600 }}>{totalSku}</span><span style={{ fontSize: '13px', color: 'var(--muted)' }}>总数</span></div>
              <div>
                <Legend color="#16a34a" text={`通过 ${detail?.summary.passedSku ?? 0}`} />
                <Legend color="#d97706" text={`待修复 ${detail?.summary.repairableSku ?? 0}`} />
                <Legend color="#e11d48" text={`阻断 ${detail?.summary.blockedSku ?? 0}`} />
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className={styles.sectionTitle} style={{ fontSize: '14px' }}>按类目分布</div>
            <div className={styles.dataTable}>
              <div className={`${styles.dataRow} ${styles.head}`}><span>类目</span><span>通过</span><span>待修复</span><span>阻断</span><span>通过率</span></div>
              {categoryRows.map((row) => (
                <div className={styles.dataRow} key={row.category}>
                  <span>{row.category}</span><span>{row.passed}</span><span>{row.repairable}</span><span>{row.blocked}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className={styles.barWrapper}><div className={styles.barFill} style={{ width: `${ratioToPercent(row.passRate)}%` }}></div></div>{formatRatioPercent(row.passRate)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className={styles.sectionTitle}>主要风险</div>
        <RiskTable riskRows={riskRows} />
      </section>

      <section>
        <div className={styles.sectionTitle}>Review 结果</div>
        <div className={styles.reviewSection}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <span>需人工 Review 任务数 <b>{reviewStats?.total ?? 0}</b></span>
            <span style={{ color: 'var(--muted)' }}>已完成 Review <b>{reviewStats?.completed ?? 0}</b></span>
            <span style={{ color: '#16a34a' }}>通过 <b>{reviewStats?.approved ?? 0}</b></span>
            <span style={{ color: '#e11d48' }}>退回 <b>{reviewStats?.rejected ?? 0}</b></span>
          </div>
          <a href="/review-approvals" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>查看全部 <ChevronRight size={14} /></a>
        </div>
      </section>
    </>
  )
}

function ReportTasksTab({ detail }: { detail: ReportDetailDto | null }) {
  const rows = [
    { label: '报告对象', entity: detail?.activity ?? detail?.sourceRun, status: detail?.status ?? '-' },
    { label: '来源运行', entity: detail?.sourceRun, status: detail?.sourceRun ? '已关联' : '未关联' },
    { label: '报告生成', entity: detail ? { label: detail.title, entityId: detail.reportId, href: `/report-center?reportId=${detail.reportId}` } : undefined, status: detail?.generatedAt ? '已生成' : '未生成' },
  ]
  return (
    <section>
      <div className={styles.sectionTitle}>任务明细</div>
      <div className={styles.dataTable}>
        <div className={`${styles.dataRow} ${styles.head}`}><span>任务</span><span>实体</span><span>ID</span><span>状态</span><span>入口</span></div>
        {rows.map((row) => (
          <div className={styles.dataRow} key={row.label}>
            <span>{row.label}</span>
            <span>{row.entity?.label ?? '-'}</span>
            <span>{row.entity?.entityId ?? '-'}</span>
            <span>{row.status}</span>
            <span>{row.entity?.href ? <a href={row.entity.href} style={{ color: 'var(--primary)' }}>打开</a> : '-'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReportRulesTab({ detail }: { detail: ReportDetailDto | null }) {
  const ruleRefs = (detail?.evidenceSummary ?? []).filter((ref) => ref.entityType === 'rule_set' || ref.ruleId)
  return (
    <>
      <section>
        <div className={styles.sectionTitle}>规则明细</div>
        <div className={styles.dataTable}>
          <div className={`${styles.dataRow} ${styles.head}`}><span>规则/证据</span><span>字段</span><span>规则 ID</span><span>来源</span><span>入口</span></div>
          {ruleRefs.length ? ruleRefs.map((ref) => (
            <div className={styles.dataRow} key={`${ref.entityId}:${ref.ruleId ?? ref.field ?? ref.label}`}>
              <span>{ref.label}</span><span>{ref.field ?? '-'}</span><span>{ref.ruleId ?? ref.entityId}</span><span>{ref.sourceType}</span><span>{ref.href ? <a href={ref.href} style={{ color: 'var(--primary)' }}>查看</a> : '-'}</span>
            </div>
          )) : <EmptyTableRow text="当前报告没有单独返回规则证据，主要风险可作为规则影响摘要。" />}
        </div>
      </section>
      <section>
        <div className={styles.sectionTitle}>规则影响摘要</div>
        <RiskTable riskRows={detail?.summary.majorRisks ?? []} />
      </section>
    </>
  )
}

function ReportEvidenceTab({ detail }: { detail: ReportDetailDto | null }) {
  const refs = detail?.evidenceSummary ?? []
  return (
    <section>
      <div className={styles.sectionTitle}>证据详情</div>
      <div className={styles.dataTable}>
        <div className={`${styles.dataRow} ${styles.head}`}><span>证据</span><span>实体类型</span><span>字段</span><span>采集时间</span><span>入口</span></div>
        {refs.length ? refs.map((ref) => (
          <div className={styles.dataRow} key={`${ref.entityType}:${ref.entityId}:${ref.field ?? ref.label}`}>
            <span>{ref.evidenceText ?? ref.label}</span><span>{ref.entityType}</span><span>{ref.field ?? '-'}</span><span>{ref.collectedAt ? new Date(ref.collectedAt).toLocaleString('zh-CN') : '-'}</span><span>{ref.href ? <a href={ref.href} style={{ color: 'var(--primary)' }}>查看</a> : '-'}</span>
          </div>
        )) : <EmptyTableRow text="当前报告没有返回证据引用。" />}
      </div>
    </section>
  )
}

function ReportRepairsTab({ repairRows }: { repairRows: ReportDetailDto['summary']['repairSuggestions'] }) {
  return (
    <section>
      <div className={styles.sectionTitle}>修复建议</div>
      <div className={styles.dataTable}>
        <div className={`${styles.dataRow} ${styles.head}`}><span>优先级</span><span>建议</span><span>影响 SKU</span><span>预期修复率</span><span>入口</span></div>
        {repairRows.length ? repairRows.map((row) => (
          <div className={styles.dataRow} key={row.suggestion}><span style={{ color: '#e11d48' }}>{row.priority}</span><span>{row.suggestion}</span><span>{row.affectedSku}</span><span>{row.estimatedLift}</span><a href={repairSuggestionSkuHref(row.priority)} style={{ color: 'var(--primary)' }}>查看 SKU</a></div>
        )) : <EmptyTableRow text="当前报告没有待修复建议。" />}
      </div>
    </section>
  )
}

function repairSuggestionSkuHref(priority: ReportDetailDto['summary']['repairSuggestions'][number]['priority']): string {
  const params = new URLSearchParams({
    healthStatus: priority === 'P0' ? 'BLOCKED' : 'REPAIRABLE',
    drawerTab: 'evidence',
  })
  return `/sku-access?${params.toString()}`
}

function reportCenterHref(reportId: string, versionId?: string | null, activeTab: ReportTab = 'SUMMARY'): string {
  const params = new URLSearchParams({ reportId })
  if (versionId) params.set('versionId', versionId)
  if (activeTab !== 'SUMMARY') params.set('tab', activeTab)
  return `/report-center?${params.toString()}`
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function RiskTable({ riskRows }: { riskRows: ReportDetailDto['summary']['majorRisks'] }) {
  return (
    <div className={styles.dataTable}>
      <div className={`${styles.dataRow} ${styles.head}`}><span>风险类型</span><span>影响 SKU</span><span>占比</span><span>风险趋势</span><span>示例问题</span></div>
      {riskRows.length ? riskRows.map((row) => (
        <div className={styles.dataRow} key={formatReportValue(row.riskType)}><span>{formatReportValue(row.riskType)}</span><span>{row.affectedSku}</span><span>{formatRatioPercent(row.ratio)}</span><span style={{ color: '#e11d48' }}>需处理</span><span>{formatReportValue(row.sampleIssue)}</span></div>
      )) : <EmptyTableRow text="当前报告没有主要风险。" />}
    </div>
  )
}

function EmptyTableRow({ text }: { text: string }) {
  return <div className={`${styles.dataRow} ${styles.emptyRow}`}><span>{text}</span></div>
}

function Legend({ color, text }: { color: string; text: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></div><span style={{ fontSize: '14px' }}>{text}</span></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.infoRow}><div className={styles.infoLabel}>{label}</div><div className={styles.infoValue}>{value}</div></div>
}

function parseRecipients(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('浏览器拒绝复制报告链接，请使用下方链接打开')
}

function ratioToPercent(value: number): number {
  const percent = Number.isFinite(value) ? (value <= 1 ? value * 100 : value) : 0
  return Math.max(0, Math.min(100, percent))
}

function formatRatioPercent(value: number): string {
  return `${ratioToPercent(value).toFixed(1)}%`
}

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value === '[object Object]' ? '结构化风险' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatReportValue).filter((item) => item !== '-').join(' / ') || '-'
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const preferred = record.message ?? record.label ?? record.summary ?? record.reason ?? record.field ?? record.id
    if (preferred !== undefined) return formatReportValue(preferred)
    return JSON.stringify(record)
  }
  return String(value)
}

function getInitialReportId(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('reportId')
}

function getInitialVersionId(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('versionId')
}

function getInitialReportTab(): ReportTab {
  if (typeof window === 'undefined') return 'SUMMARY'
  const value = new URLSearchParams(window.location.search).get('tab')
  return value === 'TASKS' || value === 'RULES' || value === 'EVIDENCE' || value === 'REPAIRS' ? value : 'SUMMARY'
}

function syncReportUrl(reportId: string, versionId?: string | null, activeTab: ReportTab = 'SUMMARY') {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  params.set('reportId', reportId)
  if (versionId) {
    params.set('versionId', versionId)
  } else {
    params.delete('versionId')
  }
  if (activeTab !== 'SUMMARY') {
    params.set('tab', activeTab)
  } else {
    params.delete('tab')
  }
  const nextUrl = `${window.location.pathname}?${params.toString()}`
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}
