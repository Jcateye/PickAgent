'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Check, CheckCircle2, ChevronRight, Database, FileSpreadsheet, Globe, Plus, RefreshCw, X } from 'lucide-react'
import type { SkuSummaryDto } from '../../../../contracts/types/businessFoundation'
import type { BrowserScanPreviewDto, ConnectorDetailDto, ConnectorKind, ConnectorListItemDto, ConnectorRunDetailDto, ConnectorRunSummaryDto, ConnectorStatus, CreateConnectorDto, UpdateConnectorDto } from '../../../../contracts/types/connectorBackend'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi, type PageDto } from './api-client'
import styles from './data-sources.module.css'

type ConnectorFormState =
  | { mode: 'create'; code: string; name: string; kind: ConnectorKind; platform: string; status: ConnectorStatus; configText: string }
  | { mode: 'edit'; connectorId: string; name: string; platform: string; status: ConnectorStatus; configText: string }
type ConnectorPanelTab = 'overview' | 'config' | 'permissions'
type BrowserScanIngestResponse = {
  preview: BrowserScanPreviewDto
  ingest: { summaries: SkuSummaryDto[]; workflowRunId: string }
  run: ConnectorRunDetailDto | null
}
interface ActionLink {
  href: string
  label: string
}

export function DataSourcesPage() {
  const [connectorPage, setConnectorPage] = useState<PageDto<ConnectorListItemDto> | null>(null)
  const [selectedConnector, setSelectedConnector] = useState<string | null>(() => getInitialConnectorId())
  const [detail, setDetail] = useState<ConnectorDetailDto | null>(null)
  const [runs, setRuns] = useState<ConnectorRunSummaryDto[]>([])
  const [connectorForm, setConnectorForm] = useState<ConnectorFormState | null>(null)
  const [panelTab, setPanelTab] = useState<ConnectorPanelTab>(() => getInitialConnectorPanelTab())
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<ActionLink | null>(null)

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
      syncConnectorUrl(null, panelTab)
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
        syncConnectorUrl(nextDetail.connectorId, panelTab)
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
  const displayRuns = selectedConnector ? runs : allRuns

  async function createConnector() {
    setConnectorForm({
      mode: 'create',
      code: `custom_${Date.now()}`,
      name: '新数据源连接器',
      kind: 'platform_api',
      platform: 'custom',
      status: 'ACTIVE',
      configText: JSON.stringify({ createdFrom: 'data-sources-page' }, null, 2),
    })
  }

  async function submitConnectorForm() {
    if (!connectorForm) return
    const name = connectorForm.name.trim()
    const platform = connectorForm.platform.trim()
    if (!name) {
      setMessage('连接器名称不能为空')
      return
    }
    let config: Record<string, unknown>
    try {
      const parsed = JSON.parse(connectorForm.configText || '{}') as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('config must be an object')
      config = parsed as Record<string, unknown>
    } catch {
      setMessage('连接器配置必须是合法 JSON 对象')
      return
    }
    setBusy(connectorForm.mode === 'create' ? 'create' : 'edit-connector')
    try {
      if (connectorForm.mode === 'create') {
        const payload: CreateConnectorDto = {
          code: connectorForm.code.trim() || `custom_${Date.now()}`,
          name,
          kind: connectorForm.kind,
          platform: platform || undefined,
          status: connectorForm.status,
          config,
        }
        const created = await fetchActivityApi<ConnectorDetailDto>('/api/connectors', { method: 'POST', body: JSON.stringify(payload) })
        setConnectorForm(null)
        setMessage(`已添加连接器：${created.name}`)
        setActionLink(connectorWriteRunActionLink(created.workflowRunId, created.connectorId, '查看创建 Run'))
        await loadConnectors(created.connectorId)
        return
      }
      const payload: UpdateConnectorDto = {
        name,
        platform: platform || null,
        status: connectorForm.status,
        config: { ...config, updatedFrom: 'data-sources-page', updatedAt: new Date().toISOString() },
      }
      const updated = await fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${connectorForm.connectorId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setConnectorForm(null)
      setDetail(updated)
      setMessage(`已更新连接器配置：${updated.name}`)
      setActionLink(connectorWriteRunActionLink(updated.workflowRunId, updated.connectorId, '查看保存 Run'))
      await loadConnectors(updated.connectorId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存连接器失败')
    } finally {
      setBusy(null)
    }
  }

  async function createRun(connectorId: string, mode: 'sync' | 'upload' = 'sync') {
    const connector = connectors.find((item) => item.connectorId === connectorId) ?? detail
    if (connector?.status === 'DISABLED') {
      setMessage('连接器已停用，请先启用后再创建运行')
      return
    }
    setBusy(connectorId)
    setActionLink(null)
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
      setActionLink({
        href: connectorRunHref(run),
        label: '查看采集 Run',
      })
      await loadConnectors(connectorId)
      const [nextDetail, nextRuns] = await Promise.all([
        fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${connectorId}`),
        fetchActivityApi<PageDto<ConnectorRunSummaryDto>>(`/api/connectors/${connectorId}/sync-runs?pageSize=10`),
      ])
      setDetail(nextDetail)
      setRuns(nextRuns.items)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '创建采集运行失败')
    } finally {
      setBusy(null)
    }
  }

  async function toggleConnectorStatus(target: ConnectorListItemDto | ConnectorDetailDto) {
    const nextStatus = target.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
    setBusy(`status:${target.connectorId}`)
    setActionLink(null)
    try {
      const payload: UpdateConnectorDto = {
        status: nextStatus,
        ...(detail?.connectorId === target.connectorId
          ? { config: { ...detail.config, statusChangedFrom: 'data-sources-page', statusChangedAt: new Date().toISOString() } }
          : {}),
      }
      const updated = await fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${target.connectorId}`, {
        method: nextStatus === 'DISABLED' ? 'DELETE' : 'PATCH',
        body: nextStatus === 'DISABLED' ? undefined : JSON.stringify(payload),
      })
      setDetail(updated)
      setMessage(`${updated.name} 已${updated.status === 'DISABLED' ? '停用' : '启用'}`)
      setActionLink(connectorWriteRunActionLink(updated.workflowRunId, updated.connectorId, '查看状态 Run'))
      await loadConnectors(updated.connectorId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '连接器状态更新失败')
    } finally {
      setBusy(null)
    }
  }

  async function editConnectorConfig() {
    if (!detail) return
    setConnectorForm({
      mode: 'edit',
      connectorId: detail.connectorId,
      name: detail.name,
      platform: detail.platform ?? '',
      status: detail.status,
      configText: JSON.stringify(detail.config, null, 2),
    })
  }

  async function reloadSelectedConnector(connectorId: string) {
    await loadConnectors(connectorId)
    const [nextDetail, nextRuns] = await Promise.all([
      fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${connectorId}`),
      fetchActivityApi<PageDto<ConnectorRunSummaryDto>>(`/api/connectors/${connectorId}/sync-runs?pageSize=10`),
    ])
    setDetail(nextDetail)
    setRuns(nextRuns.items)
  }

  async function updateConnectorPermissions(connectorId: string, permissions: string[]) {
    if (!detail || detail.connectorId !== connectorId) return
    setBusy(`permissions:${connectorId}`)
    setActionLink(null)
    try {
      const updated = await fetchActivityApi<ConnectorDetailDto>(`/api/connectors/${connectorId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          config: {
            ...detail.config,
            permissions,
            permissionsChangedFrom: 'data-sources-page',
            permissionsChangedAt: new Date().toISOString(),
          },
        }),
      })
      setDetail(updated)
      setMessage(`已更新连接器权限：${updated.permissionSummary}`)
      setActionLink(connectorWriteRunActionLink(updated.workflowRunId, updated.connectorId, '查看权限 Run'))
      await loadConnectors(updated.connectorId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '连接器权限更新失败')
    } finally {
      setBusy(null)
    }
  }
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/data-sources',
    pageTitle: '数据源连接器',
    selectedEntity: {
      entityType: 'connector',
      entityId: detail?.connectorId ?? selectedConnector ?? 'data-sources',
      label: detail?.name ?? connectors.find((item) => item.connectorId === selectedConnector)?.name ?? '数据源连接器',
    },
    visibleFilters: {
      selectedConnector,
      panelTab,
      connectorFormMode: connectorForm?.mode ?? null,
      connectorFormDraft: connectorForm
        ? {
          mode: connectorForm.mode,
          code: connectorForm.mode === 'create' ? connectorForm.code : undefined,
          name: connectorForm.name,
          kind: connectorForm.mode === 'create' ? connectorForm.kind : detail?.kind,
          platform: connectorForm.platform,
          status: connectorForm.status,
          configText: connectorForm.configText,
        }
        : null,
    },
    visibleColumns: ['connectorId', 'name', 'kind', 'status', 'latestRun', 'qualityScore'],
  }), [connectorForm, connectors, detail?.connectorId, detail?.kind, detail?.name, panelTab, selectedConnector])

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className={styles.layout}>
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>数据源 <ChevronRight size={14} /> 连接器与最近采集</div>

        <h1 className={styles.pageTitle}>数据源连接器</h1>
        <div className={styles.pageDesc}>管理数据连接器，监控采集运行状态与数据新鲜度</div>
        {message ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
            {message}
            {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
          </div>
        ) : null}
        {connectorForm ? (
          <form className={styles.connectorForm} onSubmit={(event) => { event.preventDefault(); void submitConnectorForm() }}>
            <div className={styles.formGrid}>
              {connectorForm.mode === 'create' ? (
                <label className={styles.formField}>
                  <span>编码</span>
                  <input value={connectorForm.code} onChange={(event) => setConnectorForm((current) => current && current.mode === 'create' ? { ...current, code: event.target.value } : current)} />
                </label>
              ) : null}
              <label className={styles.formField}>
                <span>名称</span>
                <input value={connectorForm.name} onChange={(event) => setConnectorForm((current) => current ? { ...current, name: event.target.value } : current)} />
              </label>
              {connectorForm.mode === 'create' ? (
                <label className={styles.formField}>
                  <span>类型</span>
                  <select value={connectorForm.kind} onChange={(event) => setConnectorForm((current) => current && current.mode === 'create' ? { ...current, kind: event.target.value as ConnectorKind } : current)}>
                    <option value="platform_api">平台 API</option>
                    <option value="browser_extension">浏览器插件</option>
                    <option value="report_import">报表导入</option>
                  </select>
                </label>
              ) : null}
              <label className={styles.formField}>
                <span>平台</span>
                <input value={connectorForm.platform} onChange={(event) => setConnectorForm((current) => current ? { ...current, platform: event.target.value } : current)} />
              </label>
              <label className={styles.formField}>
                <span>状态</span>
                <select value={connectorForm.status} onChange={(event) => setConnectorForm((current) => current ? { ...current, status: event.target.value as ConnectorStatus } : current)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="NEEDS_AUTH">NEEDS_AUTH</option>
                  <option value="FAILED">FAILED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </label>
            </div>
            <label className={styles.formField}>
              <span>配置 JSON</span>
              <textarea value={connectorForm.configText} onChange={(event) => setConnectorForm((current) => current ? { ...current, configText: event.target.value } : current)} rows={5} />
            </label>
            <div className={styles.formActions}>
              <button className="secondaryButton" type="button" onClick={() => setConnectorForm(null)} disabled={!!busy}>取消</button>
              <button className="primaryButton" type="submit" disabled={!!busy}>{connectorForm.mode === 'create' ? '添加连接器' : '保存配置'}</button>
            </div>
          </form>
        ) : null}

        <div className={styles.sectionHeader} style={{ marginTop: '16px' }}>
          <div className={styles.sectionTitle}>连接器概览</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="secondaryButton" type="button" onClick={() => void loadConnectors()} style={{ width: '32px', padding: 0, display: 'flex', justifyContent: 'center' }}><RefreshCw size={14} /></button>
            <button className="primaryButton" type="button" onClick={() => void createConnector()} disabled={!!busy}><Plus size={14} /> 添加连接器</button>
          </div>
        </div>

        <div className={styles.connectorList}>
          {connectors.map((connector) => (
            <div className={`${styles.connectorCard} ${selectedConnector === connector.connectorId ? styles.selected : ''}`} key={connector.connectorId} onClick={() => { setSelectedConnector(connector.connectorId); syncConnectorUrl(connector.connectorId, panelTab) }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') { setSelectedConnector(connector.connectorId); syncConnectorUrl(connector.connectorId, panelTab) } }}>
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
                  {connector.kind === 'report_import' ? '上传文件' : '新建运行'}
                </button>
                <button className="secondaryButton" type="button" onClick={(event) => { event.stopPropagation(); void toggleConnectorStatus(connector) }} disabled={busy === `status:${connector.connectorId}`} style={{ padding: '0 10px' }}>
                  {connector.status === 'DISABLED' ? '启用' : '停用'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>最近采集运行</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select className="secondaryButton" style={{ appearance: 'none', width: '120px' }} value={selectedConnector ?? ''} onChange={(event) => { const nextId = event.target.value || null; setSelectedConnector(nextId); syncConnectorUrl(nextId, panelTab) }}>
              <option value="">全部数据源</option>
              {connectors.map((connector) => <option value={connector.connectorId} key={connector.connectorId}>{connector.name}</option>)}
            </select>
            <button className="secondaryButton" type="button" onClick={() => selectedConnector ? void createRun(selectedConnector) : void loadConnectors()} title={selectedConnector ? '新建采集运行' : '刷新连接器'} style={{ width: '32px', padding: 0, display: 'flex', justifyContent: 'center' }}><RefreshCw size={14} /></button>
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
              <div><a href={connectorRunHref(run)} style={{ color: 'var(--primary)' }}>{run.connectorRunId}</a></div>
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
                <button className={`${styles.panelTab} ${panelTab === 'overview' ? styles.active : ''}`} type="button" onClick={() => { setPanelTab('overview'); syncConnectorUrl(detail.connectorId, 'overview') }}>概览</button>
                <button className={`${styles.panelTab} ${panelTab === 'config' ? styles.active : ''}`} type="button" onClick={() => { setPanelTab('config'); syncConnectorUrl(detail.connectorId, 'config') }}>配置</button>
                <button className={`${styles.panelTab} ${panelTab === 'permissions' ? styles.active : ''}`} type="button" onClick={() => { setPanelTab('permissions'); syncConnectorUrl(detail.connectorId, 'permissions') }}>权限</button>
              </div>
            </div>
            <button className="iconButton" type="button" onClick={() => { setSelectedConnector(null); syncConnectorUrl(null, panelTab) }}><X size={18} color="var(--muted)" /></button>
          </div>

          <div className={styles.panelBody}>
            {panelTab === 'overview' ? <ConnectorOverviewPanel key={detail.connectorId} detail={detail} runs={runs} createRun={createRun} onIngestComplete={reloadSelectedConnector} busy={busy} /> : null}
            {panelTab === 'config' ? <ConnectorConfigPanel detail={detail} editConnectorConfig={editConnectorConfig} toggleConnectorStatus={toggleConnectorStatus} busy={busy} /> : null}
            {panelTab === 'permissions' ? <ConnectorPermissionPanel detail={detail} updateConnectorPermissions={updateConnectorPermissions} busy={busy} /> : null}
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function ConnectorOverviewPanel({ detail, runs, createRun, onIngestComplete, busy }: {
  detail: ConnectorDetailDto
  runs: ConnectorRunSummaryDto[]
  createRun: (connectorId: string) => Promise<void>
  onIngestComplete: (connectorId: string) => Promise<void>
  busy: string | null
}) {
  const [scanUrl, setScanUrl] = useState('https://tmall.example.test/sku-list')
  const [scanStoreId, setScanStoreId] = useState(detail.config.storeId && typeof detail.config.storeId === 'string' ? detail.config.storeId : 'default_store')
  const [scanRowsText, setScanRowsText] = useState('[\n  {\n    "sku": "SKU-001",\n    "title": "示例商品",\n    "stock": 120,\n    "sales": 320,\n    "positiveRate": 0.98\n  }\n]')
  const [scanPreview, setScanPreview] = useState<BrowserScanPreviewDto | null>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanActionLinks, setScanActionLinks] = useState<ActionLink[]>([])
  const [scanBusy, setScanBusy] = useState<'preview' | 'ingest' | null>(null)

  async function submitBrowserScan(mode: 'preview' | 'ingest') {
    let rows: Array<Record<string, unknown>>
    try {
      const parsed = JSON.parse(scanRowsText) as unknown
      if (!Array.isArray(parsed)) throw new Error('rows must be an array')
      rows = parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    } catch {
      setScanMessage('扫描 rows 必须是 JSON 数组')
      return
    }
    if (!scanUrl.trim() || !scanStoreId.trim()) {
      setScanMessage('URL 和店铺 ID 不能为空')
      return
    }
    setScanBusy(mode)
    setScanActionLinks([])
    try {
      const payload = { connectorId: detail.connectorId, url: scanUrl.trim(), storeId: scanStoreId.trim(), platform: detail.platform ?? undefined, rows }
      if (mode === 'preview') {
        const preview = await fetchActivityApi<BrowserScanPreviewDto>('/api/connectors/browser/scan-preview', { method: 'POST', body: JSON.stringify(payload) })
        setScanPreview(preview)
        setScanMessage(`预览完成：${preview.rowCount} 行，质量分 ${preview.qualityScore}`)
        return
      }
      const result = await fetchActivityApi<BrowserScanIngestResponse>('/api/connectors/browser/scan-ingest', { method: 'POST', body: JSON.stringify(payload) })
      setScanPreview(result.preview)
      setScanMessage(`已写入 ${result.ingest.summaries.length} 个 SKU${result.run ? `，运行 ${result.run.connectorRunId}` : ''}`)
      setScanActionLinks([
        result.run ? { href: connectorRunHref(result.run), label: '查看采集 Run' } : { href: runConsoleHref(result.ingest.workflowRunId), label: '查看写入 Run' },
        { href: skuAccessHref({ sourceKind: 'browser_extension', drawerTab: 'evidence' }), label: '查看写入 SKU' },
      ])
      await onIngestComplete(detail.connectorId)
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : '浏览器扫描处理失败')
    } finally {
      setScanBusy(null)
    }
  }

  return (
    <>
      {detail.kind === 'browser_extension' ? (
        <>
          <div className={styles.blockTitle}>浏览器扫描写入</div>
          <div className={styles.browserScanBox}>
            <label className={styles.formField}>
              <span>页面 URL</span>
              <input value={scanUrl} onChange={(event) => setScanUrl(event.target.value)} />
            </label>
            <label className={styles.formField}>
              <span>店铺 ID</span>
              <input value={scanStoreId} onChange={(event) => setScanStoreId(event.target.value)} />
            </label>
            <label className={styles.formField}>
              <span>扫描 rows JSON</span>
              <textarea value={scanRowsText} onChange={(event) => setScanRowsText(event.target.value)} rows={7} />
            </label>
            <div className={styles.formActions}>
              <button className="secondaryButton" type="button" onClick={() => void submitBrowserScan('preview')} disabled={!!scanBusy || detail.status === 'DISABLED'}>预览字段</button>
              <button className="primaryButton" type="button" onClick={() => void submitBrowserScan('ingest')} disabled={!!scanBusy || detail.status === 'DISABLED'}>写入 SKU</button>
            </div>
            {scanMessage ? (
              <div className={styles.scanMessage}>
                {scanMessage}
                {scanActionLinks.map((link) => <React.Fragment key={link.href}> · <a href={link.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{link.label}</a></React.Fragment>)}
              </div>
            ) : null}
            {scanPreview ? (
              <div className={styles.scanPreview}>
                <div>ready: {String(scanPreview.ingestReady)}</div>
                <div>字段: {scanPreview.fieldMappings.map((item) => `${item.sourceField}->${item.targetField}`).join('，') || '-'}</div>
                <div>告警: {scanPreview.warnings.join('；') || '-'}</div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className={styles.blockTitle}>
        最近运行
        <button type="button" className="secondaryButton" onClick={() => void createRun(detail.connectorId)} disabled={detail.status === 'DISABLED' || busy === detail.connectorId} style={{ fontSize: '12px', padding: '4px 8px' }}>新建运行</button>
      </div>
      <div className={styles.recentRunsSmall}>
        {runs.slice(0, 5).map((run) => (
          <div className={styles.runItem} key={run.connectorRunId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className={run.status === 'FAILED' ? styles.dotRed : styles.dotGreen}></span> <a href={connectorRunHref(run)} style={{ color: 'var(--primary)' }}>{run.connectorRunId}</a></div>
            <div className={styles.success}>{run.status}</div>
            <div style={{ color: 'var(--muted)' }}>{run.startedAt ? new Date(run.startedAt).toLocaleTimeString('zh-CN') : '-'}</div>
          </div>
        ))}
        {!runs.length ? <div className={styles.emptyState}>暂无采集运行。</div> : null}
      </div>

      <div className={styles.blockTitle}>运行告警</div>
      <div className={styles.alertBox}>
        <div className={styles.alertIcon}><CheckCircle2 size={16} /></div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{runs.some((run) => run.warnings.length) ? '存在运行告警' : '暂无告警'}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{runs.flatMap((run) => run.warnings).join('；') || '最近运行无告警'}</div>
        </div>
      </div>
    </>
  )
}

function ConnectorConfigPanel({ detail, editConnectorConfig, toggleConnectorStatus, busy }: {
  detail: ConnectorDetailDto
  editConnectorConfig: () => Promise<void>
  toggleConnectorStatus: (target: ConnectorDetailDto) => Promise<void>
  busy: string | null
}) {
  return (
    <>
      <div className={styles.blockTitle}>
        当前配置
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondaryButton" type="button" onClick={() => void editConnectorConfig()} disabled={busy === 'edit-connector'} style={{ fontSize: '12px', padding: '4px 8px' }}>编辑配置</button>
          <button className="secondaryButton" type="button" onClick={() => void toggleConnectorStatus(detail)} disabled={busy === `status:${detail.connectorId}`} style={{ fontSize: '12px', padding: '4px 8px' }}>{detail.status === 'DISABLED' ? '启用' : '停用'}</button>
        </div>
      </div>
      <div className={styles.configList}>
        <div className={styles.configRow}><div className={styles.configLabel}>连接器编码</div><div className={styles.configValue}>{detail.code}</div></div>
        <div className={styles.configRow}><div className={styles.configLabel}>类型</div><div className={styles.configValue}>{detail.kind}</div></div>
        <div className={styles.configRow}><div className={styles.configLabel}>平台</div><div className={styles.configValue}>{detail.platform ?? '-'}</div></div>
        <div className={styles.configRow}><div className={styles.configLabel}>配置摘要</div><div className={styles.configValue}>{detail.configSummary}</div></div>
        <div className={styles.configRow}><div className={styles.configLabel}>权限</div><div className={styles.configValue}>{detail.permissionSummary}</div></div>
      </div>
      <pre className={styles.rawJson}>{JSON.stringify(detail.config, null, 2)}</pre>
    </>
  )
}

function ConnectorPermissionPanel({ detail, updateConnectorPermissions, busy }: {
  detail: ConnectorDetailDto
  updateConnectorPermissions: (connectorId: string, permissions: string[]) => Promise<void>
  busy: string | null
}) {
  const selectedPermissions = detail.permissions.filter((permission) => permission.granted).map((permission) => permission.key)
  const togglePermission = (permissionKey: string) => {
    const nextPermissions = selectedPermissions.includes(permissionKey)
      ? selectedPermissions.filter((item) => item !== permissionKey)
      : [...selectedPermissions, permissionKey]
    void updateConnectorPermissions(detail.connectorId, nextPermissions)
  }

  return (
    <>
      <div className={styles.blockTitle}>权限摘要</div>
      <div className={styles.authCards}>
        <div className={styles.authCard}><div className={styles.authVal}>{detail.permissions.filter((item) => item.granted).length} 个</div><div className={styles.authLabel}>已授权</div></div>
        <div className={styles.authCard}><div className={styles.authVal}>{detail.permissions.length} 个</div><div className={styles.authLabel}>权限项</div></div>
        <div className={styles.authCard}><div className={styles.authVal}>本团队</div><div className={styles.authLabel}>数据可见范围</div></div>
      </div>
      <div className={styles.permissionList}>
        {detail.permissions.map((permission) => (
          <div className={styles.permissionItem} key={permission.key}>
            <span>{permission.label}</span>
            <button
              className={permission.granted ? styles.permissionGranted : styles.permissionMissing}
              type="button"
              onClick={() => togglePermission(permission.key)}
              disabled={busy === `permissions:${detail.connectorId}`}
            >
              {permission.granted ? '已授权' : '未授权'}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function getInitialConnectorId(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('connectorId')
}

function getInitialConnectorPanelTab(): ConnectorPanelTab {
  if (typeof window === 'undefined') return 'overview'
  const value = new URLSearchParams(window.location.search).get('panelTab')
  return value === 'config' || value === 'permissions' ? value : 'overview'
}

function syncConnectorUrl(connectorId: string | null, panelTab: ConnectorPanelTab) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (connectorId) params.set('connectorId', connectorId)
  if (panelTab !== 'overview') params.set('panelTab', panelTab)
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

function connectorRunHref(run: ConnectorRunSummaryDto): string {
  return runConsoleHref(run.workflowRunRef?.entityId ?? run.connectorRunId)
}

function connectorWriteRunActionLink(workflowRunId: string | undefined, connectorId: string, label: string): ActionLink {
  return workflowRunId ? { href: runConsoleHref(workflowRunId), label } : { href: dataSourcesHref(connectorId), label: '查看连接器' }
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function dataSourcesHref(connectorId: string): string {
  const params = new URLSearchParams({ connectorId })
  return `/data-sources?${params.toString()}`
}

function skuAccessHref(state: { sourceKind?: string; drawerTab?: string }): string {
  const params = new URLSearchParams()
  if (state.sourceKind) params.set('sourceKind', state.sourceKind)
  if (state.drawerTab) params.set('drawerTab', state.drawerTab)
  const nextSearch = params.toString()
  return nextSearch ? `/sku-access?${nextSearch}` : '/sku-access'
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
