'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Bell, Check, ChevronDown, ChevronRight, Download, FileText, RefreshCw } from 'lucide-react'
import type { ReportDetailDto, ReportExportJobDto, ReportListItemDto, ReportSubscriptionDto, ReportVersionDto } from '../../../../contracts/types/reviewReportCenter'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './report-center.module.css'

type ExportFormat = 'PDF' | 'EXCEL' | 'PPT'

export function ReportCenterPage() {
  const [reports, setReports] = useState<ReportListItemDto[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ReportDetailDto | null>(null)
  const [versions, setVersions] = useState<ReportVersionDto[]>([])
  const [comparison, setComparison] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFormat>('PDF')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function loadReports(preferredId?: string | null) {
    const page = await fetchActivityApi<PageDto<ReportListItemDto>>('/api/reports')
    const list = page.items
    setReports(list)
    const nextId = preferredId ?? selectedReportId ?? list[0]?.reportId ?? null
    setSelectedReportId(nextId)
    if (nextId) await loadReportDetail(nextId)
  }

  useEffect(() => {
    loadReports().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '报告 API 加载失败'))
  }, [])

  useEffect(() => {
    if (!selectedReportId) return
    loadReportDetail(selectedReportId)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '报告详情加载失败'))
  }, [selectedReportId])

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
  }

  function switchVersion(versionId: string) {
    const version = versions.find((item) => item.versionId === versionId)
    if (!version) return
    setSelectedVersionId(versionId)
    setDetail(version)
    setMessage(`已切换报告版本：${version.version}`)
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
  const totalSku = detail?.summary.totalSku ?? 0
  const passRate = totalSku > 0 ? ((detail?.summary.passedSku ?? 0) / totalSku) * 100 : 0

  async function exportReport() {
    if (!detail) return
    setBusy('export')
    try {
      const job = await fetchActivityApi<ReportExportJobDto>(`/api/reports/${detail.reportId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format, idempotencyKey: `${detail.reportId}:${format}:${Date.now()}` }),
      })
      setMessage(`已创建导出任务：${job.exportJobId}`)
      await loadReports(detail.reportId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function subscribeReport() {
    if (!detail) return
    setBusy('subscribe')
    try {
      const subscription = await fetchActivityApi<ReportSubscriptionDto>(`/api/reports/${detail.reportId}/subscriptions`, {
        method: 'POST',
        body: JSON.stringify({ frequency: 'WEEKLY', recipients: ['ops@example.test'] }),
      })
      setMessage(`已更新订阅：${subscription.frequency} / ${subscription.recipients.join(', ')}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '订阅报告失败')
    } finally {
      setBusy(null)
    }
  }

  async function copyReportLink() {
    if (!detail) return
    const link = `${window.location.origin}/report-center?reportId=${detail.reportId}`
    await navigator.clipboard.writeText(link)
    setMessage(`已复制报告链接：${detail.reportId}`)
  }

  async function compareReports() {
    if (reports.length < 2) {
      setMessage('至少需要两个报告才能对比')
      return
    }
    const baseId = selectedReportId ?? reports[0].reportId
    const targetId = reports.find((report) => report.reportId !== baseId)?.reportId
    if (!targetId) {
      setMessage('未找到可对比的第二份报告')
      return
    }
    setBusy('compare')
    try {
      const [base, target] = await Promise.all([
        fetchActivityApi<ReportDetailDto>(`/api/reports/${baseId}`),
        fetchActivityApi<ReportDetailDto>(`/api/reports/${targetId}`),
      ])
      const baseRate = passRateText(base)
      const targetRate = passRateText(target)
      const deltaPassed = base.summary.passedSku - target.summary.passedSku
      const deltaBlocked = base.summary.blockedSku - target.summary.blockedSku
      setComparison(`${base.title} 对比 ${target.title}：通过率 ${baseRate} vs ${targetRate}，通过 SKU ${signed(deltaPassed)}，阻断 SKU ${signed(deltaBlocked)}。`)
      setMessage(`已生成报告对比：${base.reportId} / ${target.reportId}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '对比报告失败')
    } finally {
      setBusy(null)
    }
  }

  const reviewStats = detail?.summary.reviewResult
  const categoryRows = detail?.summary.categoryDistribution ?? []
  const riskRows = detail?.summary.majorRisks ?? []
  const repairRows = detail?.summary.repairSuggestions ?? []

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.topBarTitle}>报告中心</div>
          <div className={styles.topBarSub}>查看任务执行结果与合规状态，识别风险并跟踪修复进展。</div>
          {message ? <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '8px' }}>{message}</div> : null}
        </div>
        <div className={styles.actions}>
          <button className={styles.btnAction} type="button" onClick={() => void loadReports(selectedReportId)}><RefreshCw size={14} /> 刷新</button>
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
            <button className={`${styles.reportItem} ${report.reportId === selectedReportId ? styles.active : ''}`} key={report.reportId} type="button" onClick={() => setSelectedReportId(report.reportId)}>
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
            <div className={`${styles.tab} ${styles.active}`}>执行摘要</div>
            <div className={styles.tab}>任务明细</div>
            <div className={styles.tab}>规则明细</div>
            <div className={styles.tab}>证据详情</div>
            <div className={styles.tab}>修复记录</div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className={styles.barWrapper}><div className={styles.barFill} style={{ width: `${row.passRate}%` }}></div></div>{row.passRate.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className={styles.sectionTitle}>主要风险</div>
              <div className={styles.dataTable}>
                <div className={`${styles.dataRow} ${styles.head}`}><span>风险类型</span><span>影响 SKU</span><span>占比</span><span>风险趋势</span><span>示例问题</span></div>
                {riskRows.map((row) => (
                  <div className={styles.dataRow} key={row.riskType}><span>{row.riskType}</span><span>{row.affectedSku}</span><span>{row.ratio}%</span><span style={{ color: '#e11d48' }}>需处理</span><span>{row.sampleIssue}</span></div>
                ))}
              </div>
            </section>

            <section>
              <div className={styles.sectionTitle}>修复建议</div>
              <div className={styles.dataTable}>
                <div className={`${styles.dataRow} ${styles.head}`}><span>优先级</span><span>建议</span><span>影响 SKU</span><span>预期修复率</span><span>操作</span></div>
                {repairRows.map((row) => (
                  <div className={styles.dataRow} key={row.suggestion}><span style={{ color: '#e11d48' }}>{row.priority}</span><span>{row.suggestion}</span><span>{row.affectedSku}</span><span>{row.estimatedLift}</span><span style={{ color: 'var(--primary)' }}>查看详情</span></div>
                ))}
              </div>
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
            <div className={styles.checkboxItem}><input type="checkbox" checked readOnly /><span>包含图表与摘要 <span style={{ color: 'var(--primary)', fontSize: '12px' }}>(推荐)</span></span></div>
            <div className={styles.checkboxItem} style={{ marginBottom: '24px' }}><input type="checkbox" readOnly /><span>包含明细数据</span></div>
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
            <button className="secondaryButton" type="button" onClick={() => void subscribeReport()} disabled={!detail || busy === 'subscribe'} style={{ width: '100%' }}>去订阅</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, small }: { label: string; value: number; small?: string }) {
  return <div className={styles.statCard}><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value} {small ? <small>{small}</small> : null}</div><div className={styles.statChange}>来自 Report DTO</div></div>
}

function Legend({ color, text }: { color: string; text: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }}></div><span style={{ fontSize: '14px' }}>{text}</span></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.infoRow}><div className={styles.infoLabel}>{label}</div><div className={styles.infoValue}>{value}</div></div>
}

function passRateText(report: ReportDetailDto): string {
  return report.summary.totalSku > 0 ? `${((report.summary.passedSku / report.summary.totalSku) * 100).toFixed(1)}%` : '0.0%'
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}
