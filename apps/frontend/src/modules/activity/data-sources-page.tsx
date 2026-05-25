'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Check, CheckCircle2, ChevronRight, Database, FileSpreadsheet, Globe, MoreVertical, Plus, RefreshCw, X } from 'lucide-react'
import type { ConnectorDetailDto, ConnectorListItemDto, ConnectorRunSummaryDto, CreateConnectorDto, UpdateConnectorDto } from '../../../../contracts/types/connectorBackend'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './data-sources.module.css'

export function DataSourcesPage() {
  const [connectorPage, setConnectorPage] = useState<PageDto<ConnectorListItemDto> | null>(null)
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConnectorDetailDto | null>(null)
  const [runs, setRuns] = useState<ConnectorRunSummaryDto[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadConnectors(preferredId?: string | null) {
    const page = await fetchActivityApi<PageDto<ConnectorListItemDto>>('/api/connectors?pageSize=20')
    setConnectorPage(page)
    const nextId = preferredId ?? selectedConnector ?? page.items[0]?.connectorId ?? null
    setSelectedConnector(nextId)
  }

  useEffect(() => {
    loadConnectors().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '连接器加载失败'))
  }, [])

  useEffect(() => {
    if (!selectedConnector) {
      setDetail(null)
      setRuns([])
      return
    }
    let cancelled = false
    Promise.all([
      fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${selectedConnector}`),
      fetchActivityApi<PageDto<ConnectorRunSummaryDto>>(`/api/connectors/${selectedConnector}/sync-runs?pageSize=10`),
    ])
      .then(([nextDetail, nextRuns]) => {
        if (cancelled) return
        setDetail(nextDetail)
        setRuns(nextRuns.items)
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '连接器详情加载失败')
      })
    return () => {
      cancelled = true
    }
  }, [selectedConnector])

  const connectors = connectorPage?.items ?? []
  const allRuns = useMemo(() => connectors.map((connector) => connector.latestRun).filter((run): run is ConnectorRunSummaryDto => Boolean(run)), [connectors])
  const displayRuns = runs.length ? runs : allRuns

  async function createConnector() {
    const name = window.prompt('请输入连接器名称', '新数据源连接器')
    if (!name) return
    setBusy('create')
    try {
      const payload: CreateConnectorDto = {
        code: `custom_${Date.now()}`,
        name,
        kind: 'platform_api',
        platform: 'custom',
        status: 'ACTIVE',
        config: { createdFrom: 'data-sources-page' },
      }
      const created = await fetchActivityApi<ConnectorDetailDto>('/api/connectors', { method: 'POST', body: JSON.stringify(payload) })
      setMessage(`已添加连接器：${created.name}`)
      await loadConnectors(created.connectorId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '添加连接器失败')
    } finally {
      setBusy(null)
    }
  }

  async function createRun(connectorId: string, mode: 'sync' | 'upload' = 'sync') {
    setBusy(connectorId)
    try {
      const run = await fetchActivityApi<ConnectorRunSummaryDto>(`/api/connectors/${connectorId}/sync-runs`, {
        method: 'POST',
        body: JSON.stringify({
          rowCount: mode === 'upload' ? 128 : 256,
          qualityScore: mode === 'upload' ? 0.76 : 0.9,
          warnings: mode === 'upload' ? ['文件导入运行由前端工作台触发'] : [],
          summary: { triggeredBy: 'frontend_console', mode },
        }),
      })
      setMessage(`已创建采集运行：${run.connectorRunId}`)
      await loadConnectors(connectorId)
      const nextRuns = await fetchActivityApi<PageDto<ConnectorRunSummaryDto>>(`/api/connectors/${connectorId}/sync-runs?pageSize=10`)
      setRuns(nextRuns.items)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建采集运行失败')
    } finally {
      setBusy(null)
    }
  }

  async function editConnectorConfig() {
    if (!detail) return
    const name = window.prompt('修改连接器名称', detail.name)
    if (!name || name === detail.name) return
    setBusy('edit-connector')
    try {
      const payload: UpdateConnectorDto = {
        name,
        config: { ...detail.config, updatedFrom: 'data-sources-page', updatedAt: new Date().toISOString() },
      }
      const updated = await fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${detail.connectorId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setDetail(updated)
      setMessage(`已更新连接器配置：${updated.name}`)
      await loadConnectors(updated.connectorId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '编辑连接器配置失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>数据源 <ChevronRight size={14} /> 连接器与最近采集</div>

        <h1 className={styles.pageTitle}>数据源连接器</h1>
        <div className={styles.pageDesc}>管理数据连接器，监控采集运行状态与数据新鲜度</div>
        {message ? <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>{message}</div> : null}

        <div className={styles.sectionHeader} style={{ marginTop: '16px' }}>
          <div className={styles.sectionTitle}>连接器概览</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="secondaryButton" type="button" onClick={() => void loadConnectors()} style={{ width: '32px', padding: 0, display: 'flex', justifyContent: 'center' }}><RefreshCw size={14} /></button>
            <button className="primaryButton" type="button" onClick={() => void createConnector()} disabled={!!busy}><Plus size={14} /> 添加连接器</button>
          </div>
        </div>

        <div className={styles.connectorList}>
          {connectors.map((connector) => (
            <div className={`${styles.connectorCard} ${selectedConnector === connector.connectorId ? styles.selected : ''}`} key={connector.connectorId} onClick={() => setSelectedConnector(connector.connectorId)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedConnector(connector.connectorId) }}>
              <div className={styles.connectorInfo}>
                <div className={`${styles.connectorIcon} ${connectorIconClass(connector.kind)}`}>{connectorIcon(connector.kind)}</div>
                <div>
                  <div className={styles.connectorName}>
                    {connector.name}
                    <span className={`${styles.statusTag} ${connector.status === 'ACTIVE' ? styles.statusActive : styles.statusPaused}`}><div className={styles.dot} style={{ background: connector.status === 'ACTIVE' ? '#16a34a' : '#64748b', marginRight: 0 }}></div> {connector.status}</span>
                  </div>
                  <div className={styles.connectorMeta}>
                    <span>最后同步 {connector.latestRun?.completedAt ? new Date(connector.latestRun.completedAt).toLocaleTimeString('zh-CN') : '-'}</span>
                    <span>{connector.configSummary}</span>
                  </div>
                </div>
              </div>
              <div className={styles.connectorActions}>
                <button className="secondaryButton" type="button" onClick={(event) => { event.stopPropagation(); void createRun(connector.connectorId, connector.kind === 'report_import' ? 'upload' : 'sync') }} disabled={busy === connector.connectorId}>
                  {connector.kind === 'report_import' ? '上传文件' : '查看运行'}
                </button>
                <MoreVertical size={16} color="var(--muted)" />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>最近采集运行</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select className="secondaryButton" style={{ appearance: 'none', width: '120px' }} value={selectedConnector ?? ''} onChange={(event) => setSelectedConnector(event.target.value || null)}>
              <option value="">全部数据源</option>
              {connectors.map((connector) => <option value={connector.connectorId} key={connector.connectorId}>{connector.name}</option>)}
            </select>
            <button className="secondaryButton" type="button" onClick={() => selectedConnector ? void createRun(selectedConnector) : void loadConnectors()} style={{ width: '32px', padding: 0, display: 'flex', justifyContent: 'center' }}><RefreshCw size={14} /></button>
          </div>
        </div>

        <div className={styles.recentRunsTable}>
          <div className={styles.tableHeader}>
            <div>运行 ID</div>
            <div>数据源</div>
            <div>采集行数</div>
            <div>数据新鲜度</div>
            <div>结果</div>
            <div>证据质量</div>
            <div>运行时间</div>
          </div>

          {displayRuns.map((run) => (
            <div className={styles.tableRow} key={run.connectorRunId}>
              <div style={{ color: 'var(--muted)' }}>{run.connectorRunId}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{connectorIcon(connectors.find((item) => item.connectorId === run.connectorId)?.kind)} {connectors.find((item) => item.connectorId === run.connectorId)?.name ?? run.connectorId}</div>
              <div>{run.rowCount.toLocaleString()}</div>
              <div><span className={run.status === 'FAILED' ? styles.dotRed : styles.dotGreen}></span>{run.completedAt ? new Date(run.completedAt).toLocaleString('zh-CN') : '运行中'}</div>
              <div style={{ color: run.status === 'FAILED' ? '#dc2626' : '#16a34a' }}><Check size={14} /> {run.status}</div>
              <div><span className={(run.qualityScore ?? 0) >= 0.8 ? styles.dotGreen : styles.dotOrange}></span>{run.qualityScore?.toFixed(2) ?? '-'}</div>
              <div>{run.startedAt ? new Date(run.startedAt).toLocaleTimeString('zh-CN') : '-'}</div>
            </div>
          ))}

          <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)' }}>
            <div>共 {displayRuns.length} 条</div>
          </div>
        </div>
      </div>

      {detail && (
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <div style={{ flex: 1 }}>
              <div className={styles.panelTitle}>
                {connectorIcon(detail.kind)} {detail.name}
                <span className={`${styles.statusTag} ${detail.status === 'ACTIVE' ? styles.statusActive : styles.statusPaused}`} style={{ marginLeft: 'auto', fontWeight: 400 }}><div className={styles.dot} style={{ background: detail.status === 'ACTIVE' ? '#16a34a' : '#64748b', marginRight: 0 }}></div> {detail.status}</span>
              </div>
              <div className={styles.panelTabs}>
                <div className={`${styles.panelTab} ${styles.active}`}>概览</div>
                <div className={styles.panelTab}>配置</div>
                <div className={styles.panelTab}>权限</div>
              </div>
            </div>
            <button className="iconButton" type="button" onClick={() => setSelectedConnector(null)}><X size={18} color="var(--muted)" /></button>
          </div>

          <div className={styles.panelBody}>
            <div className={styles.blockTitle}>
              当前配置
              <button className="secondaryButton" type="button" onClick={() => void editConnectorConfig()} disabled={busy === 'edit-connector'} style={{ fontSize: '12px', padding: '4px 8px' }}>编辑配置</button>
            </div>
            <div className={styles.configList}>
              <div className={styles.configRow}><div className={styles.configLabel}>连接器编码</div><div className={styles.configValue}>{detail.code}</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>类型</div><div className={styles.configValue}>{detail.kind}</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>平台</div><div className={styles.configValue}>{detail.platform ?? '-'}</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>配置摘要</div><div className={styles.configValue}>{detail.configSummary}</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>权限</div><div className={styles.configValue}>{detail.permissionSummary}</div></div>
            </div>

            <div className={styles.blockTitle}>权限摘要</div>
            <div className={styles.authCards}>
              <div className={styles.authCard}><div className={styles.authVal}>{detail.permissions.filter((item) => item.granted).length} 个</div><div className={styles.authLabel}>已授权</div></div>
              <div className={styles.authCard}><div className={styles.authVal}>{detail.permissions.length} 个</div><div className={styles.authLabel}>权限项</div></div>
              <div className={styles.authCard}><div className={styles.authVal}>本团队</div><div className={styles.authLabel}>数据可见范围</div></div>
            </div>

            <div className={styles.blockTitle}>
              最近运行
              <button type="button" className="secondaryButton" onClick={() => void createRun(detail.connectorId)} style={{ fontSize: '12px', padding: '4px 8px' }}>新建运行</button>
            </div>
            <div className={styles.recentRunsSmall}>
              {runs.slice(0, 3).map((run) => (
                <div className={styles.runItem} key={run.connectorRunId}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className={run.status === 'FAILED' ? styles.dotRed : styles.dotGreen}></span> {run.connectorRunId}</div>
                  <div className={styles.success}>{run.status}</div>
                  <div style={{ color: 'var(--muted)' }}>{run.startedAt ? new Date(run.startedAt).toLocaleTimeString('zh-CN') : '-'}</div>
                </div>
              ))}
            </div>

            <div className={styles.blockTitle}>运行告警</div>
            <div className={styles.alertBox}>
              <div className={styles.alertIcon}><CheckCircle2 size={16} /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{runs.some((run) => run.warnings.length) ? '存在运行告警' : '暂无告警'}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{runs.flatMap((run) => run.warnings).join('；') || '最近运行无告警'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function connectorIcon(kind?: string) {
  if (kind === 'browser_extension') return <Globe size={20} />
  if (kind === 'platform_api') return <ArrowDownUp size={20} />
  if (kind === 'report_import') return <FileSpreadsheet size={20} />
  return <Database size={20} />
}

function connectorIconClass(kind?: string) {
  if (kind === 'browser_extension') return styles.cChrome
  if (kind === 'platform_api') return styles.cApi
  if (kind === 'report_import') return styles.cCsv
  return styles.cErp
}
