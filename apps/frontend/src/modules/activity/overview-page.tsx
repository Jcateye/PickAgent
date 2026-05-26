'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { FileText, Database, Plug, LayoutList, CheckCircle2, ChevronRight, Download, Filter, HelpCircle, FileCheck2, ChevronDown, Lock, ShieldAlert, Check } from 'lucide-react'
import type { RuleSetListItemDto } from '../../../../contracts/types/businessFoundation'
import type { ConnectorListItemDto } from '../../../../contracts/types/connectorBackend'
import type { DashboardSkuListItemDto } from '../../../../contracts/types/dashboardSkuReadModels'
import type { ReviewListItemDto } from '../../../../contracts/types/reviewReportCenter'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi, type HealthSummaryDto, type PageDto } from './api-client'
import styles from './overview.module.css'

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

interface RunConsolePageDto {
  items: RunConsoleItemDto[]
  total: number
}

interface SkuExportDto {
  fileName: string
  contentType: 'text/csv'
  csv: string
  rowCount: number
  artifactHref?: string
  artifactContentType?: 'text/csv'
  workflowRunId?: string
}

export function OverviewPage() {
  const [summary, setSummary] = useState<HealthSummaryDto | null>(null)
  const [skuPage, setSkuPage] = useState<PageDto<DashboardSkuListItemDto> | null>(null)
  const [reviewPage, setReviewPage] = useState<PageDto<ReviewListItemDto> | null>(null)
  const [runPage, setRunPage] = useState<RunConsolePageDto | null>(null)
  const [rulePage, setRulePage] = useState<PageDto<RuleSetListItemDto> | null>(null)
  const [connectorPage, setConnectorPage] = useState<PageDto<ConnectorListItemDto> | null>(null)
  const [statusFilter, setStatusFilter] = useState<DashboardSkuListItemDto['healthStatus'] | 'ALL'>(() => getInitialOverviewStatus())
  const [page, setPage] = useState(() => getInitialOverviewPage())
  const [message, setMessage] = useState<string | null>(null)
  const [exportLink, setExportLink] = useState<{ href: string; label: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      page: String(page),
      pageSize: '5',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })
    if (statusFilter !== 'ALL') params.set('healthStatus', statusFilter)
    syncOverviewUrl({ page, statusFilter })
    Promise.all([
      fetchActivityApi<HealthSummaryDto>('/api/health/summary'),
      fetchActivityApi<PageDto<DashboardSkuListItemDto>>(`/api/skus?${params.toString()}`),
      fetchActivityApi<PageDto<ReviewListItemDto>>('/api/reviews?pageSize=20'),
      fetchActivityApi<RunConsolePageDto>('/api/run-console'),
      fetchActivityApi<PageDto<RuleSetListItemDto>>('/api/rule-sets?pageSize=20'),
      fetchActivityApi<PageDto<ConnectorListItemDto>>('/api/connectors?pageSize=20'),
    ])
      .then(([nextSummary, nextSkuPage, nextReviewPage, nextRunPage, nextRulePage, nextConnectorPage]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setSkuPage(nextSkuPage)
        setReviewPage(nextReviewPage)
        setRunPage(nextRunPage)
        setRulePage(nextRulePage)
        setConnectorPage(nextConnectorPage)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [page, statusFilter])

  const overview = useMemo(() => {
    const total = summary?.total ?? 0
    const ready = summary?.ready ?? 0
    const blocked = summary?.blocked ?? 0
    const reviewCount = reviewPage?.total ?? 0
    return {
      total,
      ready,
      blocked,
      reviewCount,
      readyRate: total > 0 ? `${((ready / total) * 100).toFixed(1)}%` : '0.0%',
    }
  }, [reviewPage?.total, summary])

  const apiRows = skuPage?.items ?? []
  const runs = runPage?.items ?? []
  const rules = rulePage?.items ?? []
  const connectors = connectorPage?.items ?? []
  const latestRule = rules[0] ?? null
  const activeRules = rules.filter((rule) => rule.status === 'ENABLED')
  const healthyConnectors = connectors.filter((connector) => connector.status === 'ACTIVE' && connector.latestRun?.status !== 'FAILED')
  const abnormalConnectors = connectors.filter((connector) => connector.status === 'FAILED' || connector.status === 'NEEDS_AUTH' || connector.latestRun?.status === 'FAILED')
  const latestConnectorRunAt = latestRunTime(connectors)
  const averageQuality = averageConnectorQuality(connectors)
  const latestRun = runs[0] ?? null
  const latestRunLogs = latestRun?.logs.slice(0, 5) ?? []
  const missionSteps = buildMissionSteps(runs, reviewPage?.items ?? [])
  const reviewRate = overview.total > 0 ? `${((overview.reviewCount / overview.total) * 100).toFixed(1)}%` : '0.0%'
  const totalPages = Math.max(1, Math.ceil((skuPage?.total ?? 0) / (skuPage?.pageSize ?? 5)))
  const visiblePages = paginationWindow(page, totalPages)
  const latestRuleHref = latestRule ? ruleLibraryHref(latestRule.ruleSetId) : '/rule-library'
  const primaryConnector = abnormalConnectors[0] ?? healthyConnectors[0] ?? connectors[0] ?? null
  const primaryConnectorHref = primaryConnector ? dataSourcesHref(primaryConnector.connectorId) : '/data-sources'
  const latestRunHref = latestRun ? runConsoleHref(latestRun.runId) : '/run-console'
  const skuAccessHref = statusFilter === 'ALL' ? '/sku-access' : skuAccessStatusHref(statusFilter)
  const currentSkuQuery = useMemo(() => ({
    sortBy: 'updatedAt' as const,
    sortOrder: 'desc' as const,
    healthStatus: statusFilter === 'ALL' ? undefined : statusFilter,
  }), [statusFilter])
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/overview',
    pageTitle: '业务概览',
    selectedEntity: { entityType: 'dashboard', entityId: 'overview', label: '业务概览' },
    visibleFilters: { statusFilter, page, currentSkuQuery },
    visibleColumns: ['skuProfileId', 'healthStatus', 'nextAction', 'evidenceCount'],
  }), [currentSkuQuery, page, statusFilter])

  async function exportCurrentSkuRows() {
    setExporting(true)
    setExportLink(null)
    try {
      const exported = await fetchActivityApi<SkuExportDto>('/api/skus/export', {
        method: 'POST',
        body: JSON.stringify({
          query: currentSkuQuery,
        }),
      })
      downloadCsv(exported)
      setMessage(`已导出 Overview SKU 清单：${exported.rowCount} 行${exported.workflowRunId ? ` / Run ${exported.workflowRunId}` : ''}`)
      setExportLink(exported.artifactHref ? { href: exported.artifactHref, label: '下载导出文件' } : exported.workflowRunId ? { href: runConsoleHref(exported.workflowRunId), label: '查看导出 Run' } : null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出 SKU 失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className={styles.layout}>
      {/* Left Main Content */}
      <div className={styles.mainContent}>
        
        {/* Header Summary */}
        <div className={styles.pageHeader}>
          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>{latestRule ? `执行${latestRule.name}` : '执行 SKU Ready 规则检查'}</h1>
            <div className={styles.runningBadge}>
              <div className={styles.pulseDot}></div>
              {latestRun ? statusLabel(latestRun.status) : '待运行'}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fg)', marginBottom: '8px' }}>
            <strong>目标：</strong>解析并校验当前启用规则，识别不符合项，生成可报名 SKU 清单与待处理项。
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            <strong>下一步：</strong>{nextOverviewAction(missionSteps, overview.reviewCount)}
          </div>
          {message ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              {message}
              {exportLink ? <> · <a href={exportLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{exportLink.label}</a></> : null}
            </div>
          ) : null}
          
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>证据摘要</span>
              <div className={styles.evidenceRow} style={{ marginTop: '12px' }}>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><FileCheck2 size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>规则版本</span>
                    <span className={styles.evidenceData}>{latestRule?.version ?? '暂无规则'}</span>
                    <a href={latestRuleHref} className={styles.evidenceLink}>查看规则</a>
                  </div>
                </div>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><Database size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>数据源</span>
                    <span className={styles.evidenceData}>{healthyConnectors.length}/{connectors.length} 正常</span>
                    <a href={primaryConnectorHref} className={styles.evidenceLink}>查看数据</a>
                  </div>
                </div>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><Plug size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>插件任务</span>
                    <span className={styles.evidenceData}>{runs.filter((run) => isSucceeded(run.status)).length}/{runs.length} 成功</span>
                    <a href={latestRunHref} className={styles.evidenceLink}>查看 Run</a>
                  </div>
                </div>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><LayoutList size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>诊断结果</span>
                    <span className={styles.evidenceData}>{overview.total.toLocaleString()} 个 SKU</span>
                    <a href={skuAccessHref} className={styles.evidenceLink}>查看证据</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className={styles.stepperContainer}>
          {missionSteps.map((step, index) => (
            <div className={styles.stepItem} style={index === missionSteps.length - 1 ? { flex: 0, minWidth: '80px' } : undefined} key={step.label}>
              <div className={`${styles.stepIcon} ${step.status === 'completed' ? styles.completed : step.status === 'running' ? styles.running : styles.waiting}`}>
                {step.status === 'completed' ? <Check size={16} /> : index + 1}
              </div>
              <div className={styles.stepLabel} style={step.status === 'running' ? { color: 'var(--primary)' } : undefined}>{step.label.replace(/^[0-9]+\\. /, `${index + 1} `)}</div>
              <div className={styles.stepStatus} style={step.status === 'running' ? { color: 'var(--primary)' } : undefined}>{step.statusText}</div>
              <div className={styles.stepTime}>{formatTime(step.time)}</div>
              {index < missionSteps.length - 1 ? <div className={`${styles.stepLine} ${step.status === 'completed' ? styles.completed : step.status === 'running' ? styles.running : styles.waiting}`}></div> : null}
            </div>
          ))}
        </div>

        {/* Indicators */}
        <div className={styles.indicatorsRow}>
          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>规则解析</div>
            <div className={styles.indicatorMain}>
              <div className={styles.indicatorBigValue}>{latestRule?.version ?? '-'}</div>
              <div className={styles.ruleVersionBadge}>{latestRule?.status ?? 'NO_RULE'}</div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginTop: 'auto', marginBottom: '16px' }}>
              <span>规则集 <span className={styles.indicatorMetaVal}>{rules.length} 个</span></span>
              <span>启用 <span className={styles.indicatorMetaVal}>{activeRules.length} 个</span></span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href={latestRuleHref} className={styles.evidenceLink}>查看规则</a>
            </div>
          </div>

          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>数据新鲜度</div>
            <div className={styles.donutWrapper}>
              <div className={styles.donutCircle}>
                <div className={styles.donutInner}>{averageQuality}</div>
              </div>
              <div className={styles.donutMeta}>
                <div style={{ color: 'var(--muted)' }}>整体新鲜度</div>
                <div style={{ color: 'var(--fg)', fontWeight: 500 }}>最新更新时间</div>
                <div>{latestConnectorRunAt ? formatDateTime(latestConnectorRunAt) : '-'}</div>
              </div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginBottom: '16px' }}>
              <span>异常数据源</span>
              <span className={styles.indicatorMetaVal} style={{ color: '#ef4444' }}>{abnormalConnectors.length} 个</span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href={primaryConnectorHref} className={styles.evidenceLink}>查看数据详情</a>
            </div>
          </div>

          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>可直接报名 SKU</div>
            <div className={styles.indicatorMain}>
              <div className={`${styles.indicatorBigValue} ${styles.green}`}>{overview.ready.toLocaleString()}</div>
              <div className={`${styles.indicatorSubValue} ${styles.green}`}>{overview.readyRate}</div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginTop: 'auto', marginBottom: '16px' }}>
              <span>已通过 <span className={styles.indicatorMetaVal}>{overview.ready.toLocaleString()}</span></span>
              <span>占比 <span className={styles.indicatorMetaVal}>{overview.readyRate}</span></span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href={skuAccessStatusHref('READY')} className={styles.evidenceLink}>查看清单</a>
            </div>
          </div>

          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>待人工确认</div>
            <div className={styles.indicatorMain}>
              <div className={`${styles.indicatorBigValue} ${styles.orange}`}>{overview.reviewCount.toLocaleString()}</div>
              <div className={`${styles.indicatorSubValue} ${styles.orange}`}>{reviewRate}</div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginTop: 'auto', marginBottom: '16px' }}>
              <span>需审批 <span className={styles.indicatorMetaVal}>{overview.reviewCount.toLocaleString()}</span></span>
              <span>阻塞 <span className={styles.indicatorMetaVal}>{overview.blocked.toLocaleString()}</span></span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href="/review-approvals?tab=PENDING" className={styles.evidenceLink}>进入审核</a>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitle}>
              关键结论 (按风险优先)
              <HelpCircle size={14} color="var(--muted)" style={{ cursor: 'pointer' }} />
            </div>
            <div className={styles.tableActions}>
              <select className="secondaryButton" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as DashboardSkuListItemDto['healthStatus'] | 'ALL'); setPage(1) }} style={{ height: '32px', fontSize: '13px' }}>
                <option value="ALL">全部状态</option>
                <option value="READY">通过</option>
                <option value="REPAIRABLE">可修复</option>
                <option value="RISKY">待确认</option>
                <option value="BLOCKED">不符合</option>
              </select>
              <button className="secondaryButton" type="button" onClick={() => { setStatusFilter('ALL'); setPage(1) }} style={{ height: '32px', fontSize: '13px' }}>
                <Filter size={14} /> 重置筛选
              </button>
              <button className="secondaryButton" type="button" onClick={() => void exportCurrentSkuRows()} disabled={exporting} style={{ height: '32px', fontSize: '13px' }}>
                <Download size={14} /> 导出
              </button>
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>状态</th>
                  <th>主要原因</th>
                  <th>影响活动</th>
                  <th>下一步</th>
                  <th>证据</th>
                </tr>
              </thead>
              <tbody>
                {apiRows.map((item) => (
                  <tr key={item.skuProfileId}>
                    <td>{item.displaySku}</td>
                    <td><span className={`${styles.statusTag} ${item.healthStatus === 'READY' ? styles.success : item.healthStatus === 'REPAIRABLE' || item.healthStatus === 'RISKY' ? styles.warning : styles.danger}`}>{healthStatusLabel(item.healthStatus)}</span></td>
                    <td>{item.eligibilityLabel ?? '—'} <span className={styles.ruleTag}>健康诊断</span></td>
                    <td>{latestRule?.name ?? '当前规则集'}</td>
                    <td>{item.nextAction.label}</td>
                    <td><a href={skuEvidenceHref(item.skuProfileId)} className={styles.evidenceLink}>查看证据 <ChevronRight size={14} /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.tablePagination}>
            <span>共 {(skuPage?.total ?? overview.total).toLocaleString()} 条</span>
            <div className={styles.pageControls}>
              <span style={{ fontSize: '12px' }}>{skuPage?.pageSize ?? 5} 条/页</span>
              <button className={styles.pageBtn} type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }}/></button>
              {visiblePages[0] > 1 ? <span>...</span> : null}
              {visiblePages.map((pageNumber) => (
                <button key={pageNumber} className={`${styles.pageBtn} ${pageNumber === page ? styles.active : ''}`} type="button" disabled={pageNumber === page} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
              ))}
              {visiblePages.at(-1)! < totalPages ? <span>...</span> : null}
              <button className={styles.pageBtn} type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.consoleHeader}>
          <div className={styles.consoleTitle}>Agent Mission Console</div>
          <div className={styles.consoleActions}>
            <ChevronDown size={16} style={{ cursor: 'pointer' }} />
            <ChevronRight size={16} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div className={styles.consoleSection}>
          <div className={styles.consoleRunId}>
            <span>最新 Run：{latestRun ? `#${shortId(latestRun.runId)}` : '暂无运行'}</span>
            <span className={styles.consoleRunBadge}>{latestRun ? statusLabel(latestRun.status) : '-'}</span>
          </div>
          
          <div className={styles.stepListTitle}>执行步骤</div>
          
          {missionSteps.map((step) => (
            <div className={`${styles.vStep} ${step.status === 'completed' ? styles.completed : step.status === 'running' ? styles.running : ''}`} key={step.label}>
              <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
              <div className={styles.vStepContent}>
                <span className={styles.vStepLabel}>{step.label}</span>
                <div className={styles.vStepStatus}>
                  {step.status === 'waiting'
                    ? <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{step.statusText}</span>
                    : <span className={`${styles.statusBadge} ${step.status === 'completed' ? styles.completed : styles.running}`}>{step.statusText}</span>}
                  <span className={styles.vStepTime}>{formatTime(step.time)}</span>
                </div>
              </div>
            </div>
          ))}

        </div>

        <div className={styles.consoleSection}>
          <div className={styles.stepListTitle} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span>工具运行状态 ({runs.filter((run) => isSucceeded(run.status)).length}/{runs.length})</span>
            <ChevronDown size={14} />
          </div>
          
          <div className={styles.toolsList}>
            {runs.slice(0, 5).map((run) => (
              <div className={styles.toolItem} key={run.runId}>
                <div className={styles.toolName}>{runIcon(run.type)} {run.subject}</div>
                <div className={styles.toolStatus}>
                  <span className={isSucceeded(run.status) ? styles.toolSuccessText : undefined}>{statusLabel(run.status)}</span>
                  <span className={styles.toolTime}>{formatTime(run.startedAt ?? run.completedAt)}</span>
                </div>
              </div>
            ))}
            {!runs.length ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>暂无运行记录。</div> : null}
            <a href={latestRunHref} className={styles.evidenceLink} style={{ marginTop: '4px' }}>查看全部工具 Run</a>
          </div>
        </div>

        <div className={styles.consoleSection}>
          <div className={styles.lockSection}>
            <div className={styles.lockHeader}>
              <span>工具 Trace (已折叠)</span>
              <Lock size={14} color="var(--muted)" />
            </div>
            <div className={styles.lockDesc}>{latestRunLogs.length ? latestRunLogs.map((log) => `${log.tag}: ${log.message}`).join('；') : '包含请求/响应、原始字段与日志'}</div>
            <a href={latestRunHref} className={styles.evidenceLink} style={{ marginTop: '4px' }}>查看 Trace</a>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

function shortId(value: string): string {
  return value.slice(0, 8)
}

function formatTime(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function isSucceeded(status: string): boolean {
  return ['SUCCEEDED', 'SUCCESS', 'COMPLETED', 'DONE'].includes(status.toUpperCase())
}

function statusLabel(status: string): string {
  if (isSucceeded(status)) return '成功'
  if (['RUNNING', 'IN_PROGRESS', 'PROCESSING'].includes(status.toUpperCase())) return '运行中'
  if (['FAILED', 'ERROR'].includes(status.toUpperCase())) return '失败'
  return status
}

function runIcon(type: string) {
  if (type === 'connector_sync') return <Database size={14} />
  if (type === 'agent_run') return <CheckCircle2 size={14} />
  if (type.includes('review')) return <FileCheck2 size={14} />
  if (type.includes('activity')) return <ShieldAlert size={14} />
  return <FileText size={14} />
}

type MissionStepStatus = 'completed' | 'running' | 'waiting'

interface MissionStepView {
  label: string
  status: MissionStepStatus
  statusText: string
  time?: string
}

function buildMissionSteps(runs: RunConsoleItemDto[], reviews: ReviewListItemDto[]): MissionStepView[] {
  const connectorRun = runs.find((run) => run.type === 'connector_sync')
  const activityRun = runs.find((run) => run.type.includes('activity') || run.subject.includes('规则') || run.subject.includes('模拟'))
  const reviewRun = runs.find((run) => run.type.includes('review'))
  const latestRun = runs[0]
  const completedConnector = connectorRun && isSucceeded(connectorRun.status)
  const completedActivity = activityRun && isSucceeded(activityRun.status)
  const pendingReviews = reviews.filter((review) => review.status === 'PENDING').length
  return [
    stepFromRun('1. 规则解析', activityRun ?? latestRun, Boolean(activityRun)),
    stepFromRun('2. 数据检查', connectorRun ?? latestRun, Boolean(connectorRun)),
    stepFromRun('3. 插件采集', connectorRun, Boolean(completedConnector)),
    stepFromRun('4. SKU 诊断', latestRun, Boolean(latestRun && isSucceeded(latestRun.status))),
    stepFromRun('5. 准入模拟', activityRun, Boolean(completedActivity)),
    {
      label: '6. Review 生成',
      status: reviewRun && isSucceeded(reviewRun.status) ? 'completed' : pendingReviews > 0 ? 'running' : 'waiting',
      statusText: reviewRun && isSucceeded(reviewRun.status) ? '已完成' : pendingReviews > 0 ? `${pendingReviews} 项待审` : '等待中',
      time: reviewRun?.completedAt ?? reviewRun?.startedAt,
    },
  ]
}

function stepFromRun(label: string, run: RunConsoleItemDto | undefined, completed: boolean): MissionStepView {
  if (completed) return { label, status: 'completed', statusText: '已完成', time: run?.completedAt ?? run?.startedAt }
  if (run && !isSucceeded(run.status)) return { label, status: 'running', statusText: statusLabel(run.status), time: run.startedAt ?? run.completedAt }
  return { label, status: 'waiting', statusText: '等待中' }
}

function nextOverviewAction(steps: MissionStepView[], reviewCount: number): string {
  const running = steps.find((step) => step.status === 'running')
  if (running) return `${running.label.replace(/^[0-9]+\\. /, '')}正在处理，完成后继续下一步。`
  const waiting = steps.find((step) => step.status === 'waiting')
  if (waiting) return `等待${waiting.label.replace(/^[0-9]+\\. /, '')}。`
  if (reviewCount > 0) return `进入人工确认，当前有 ${reviewCount} 个 Review 项。`
  return '当前执行步骤已完成，继续查看报告或运行记录。'
}

function latestRunTime(connectors: ConnectorListItemDto[]): string | undefined {
  return connectors
    .map((connector) => connector.latestRun?.completedAt ?? connector.latestRun?.startedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0]
}

function averageConnectorQuality(connectors: ConnectorListItemDto[]): string {
  const scores = connectors.map((connector) => connector.latestRun?.qualityScore).filter((value): value is number => typeof value === 'number')
  if (!scores.length) return '0%'
  return `${Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100)}%`
}

function formatDateTime(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function healthStatusLabel(status: DashboardSkuListItemDto['healthStatus']): string {
  if (status === 'READY') return '通过'
  if (status === 'REPAIRABLE') return '可修复'
  if (status === 'RISKY') return '待确认'
  return '不符合'
}

function getInitialOverviewParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function getInitialOverviewPage(): number {
  const value = Number(getInitialOverviewParam('page') ?? 1)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
}

function getInitialOverviewStatus(): DashboardSkuListItemDto['healthStatus'] | 'ALL' {
  const value = getInitialOverviewParam('healthStatus')
  return value === 'READY' || value === 'REPAIRABLE' || value === 'RISKY' || value === 'BLOCKED' ? value : 'ALL'
}

function syncOverviewUrl(state: { page: number; statusFilter: DashboardSkuListItemDto['healthStatus'] | 'ALL' }) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (state.page > 1) params.set('page', String(state.page))
  else params.delete('page')
  if (state.statusFilter !== 'ALL') params.set('healthStatus', state.statusFilter)
  else params.delete('healthStatus')
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

function skuEvidenceHref(skuProfileId: string): string {
  const params = new URLSearchParams({ skuProfileId, drawerTab: 'evidence' })
  return `/sku-access?${params.toString()}`
}

function skuAccessStatusHref(healthStatus: DashboardSkuListItemDto['healthStatus']): string {
  const params = new URLSearchParams({ healthStatus })
  return `/sku-access?${params.toString()}`
}

function ruleLibraryHref(ruleSetId: string): string {
  const params = new URLSearchParams({ ruleSetId })
  return `/rule-library?${params.toString()}`
}

function dataSourcesHref(connectorId: string): string {
  const params = new URLSearchParams({ connectorId })
  return `/data-sources?${params.toString()}`
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function paginationWindow(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
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
