'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, RotateCcw } from 'lucide-react'
import { fetchActivityApi } from './api-client'
import styles from './run-console.module.css'

interface RunConsoleItemDto {
  runId: string
  type: string
  status: string
  subject: string
  sourceId?: string
  sourceHref?: string
  startedAt?: string
  completedAt?: string
  summary: string
  logs: Array<{ time?: string; tag: string; message: string; payload?: unknown }>
}

interface RunConsolePageDto {
  items: RunConsoleItemDto[]
  total: number
}

interface RunConsoleLogExportDto {
  runId: string
  fileName: string
  contentType: 'text/plain'
  content: string
  lineCount: number
}

interface ConnectorRunRetryDto {
  connectorRunId: string
  workflowRunRef?: { entityId: string }
}

type RunConsoleTab = 'timeline' | 'raw' | 'tools'

const runConsoleTabs: Array<{ value: RunConsoleTab; label: string }> = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'raw', label: 'Raw Logs' },
  { value: 'tools', label: 'Tool Traces' },
]

export function RunConsolePage() {
  const [runs, setRuns] = useState<RunConsoleItemDto[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(() => getInitialRunConsoleParam('runId'))
  const [activeTab, setActiveTab] = useState<RunConsoleTab>(() => getInitialRunConsoleTab())
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<{ href: string; label: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function loadRuns() {
    setLoading(true)
    try {
      const page = await fetchActivityApi<RunConsolePageDto>('/api/run-console?pageSize=100')
      setRuns(page.items)
      setSelectedRunId((current) => {
        const preferredRunId = current ?? getInitialRunConsoleParam('runId')
        if (preferredRunId && page.items.some((item) => item.runId === preferredRunId)) return preferredRunId
        if (preferredRunId) setMessage(`未在最近 ${page.items.length} 条运行记录中找到 Run：${preferredRunId}`)
        return page.items[0]?.runId ?? null
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Run Console 加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRuns()
  }, [])

  const selectedRun = useMemo(() => runs.find((run) => run.runId === selectedRunId) ?? runs[0] ?? null, [runs, selectedRunId])

  useEffect(() => {
    syncRunConsoleUrl(selectedRun?.runId ?? selectedRunId, activeTab)
  }, [selectedRun?.runId, selectedRunId, activeTab])

  async function exportLogs() {
    if (!selectedRun) return
    setBusy('export')
    try {
      const exported = await fetchActivityApi<RunConsoleLogExportDto>(`/api/run-console/${encodeURIComponent(selectedRun.runId)}/export`, { method: 'POST', body: JSON.stringify({}) })
      const blob = new Blob([exported.content], { type: `${exported.contentType};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exported.fileName
      link.click()
      URL.revokeObjectURL(url)
      setMessage(`已导出 Run 日志：${exported.runId} / ${exported.lineCount} 行`)
      setActionLink({ href: runConsoleHref(exported.runId, 'raw'), label: '查看 Raw Logs' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出 Run 日志失败')
    } finally {
      setBusy(null)
    }
  }

  async function retryRun() {
    if (!selectedRun) return
    if (!isFailed(selectedRun.status)) {
      setMessage(`当前 Run 状态为 ${selectedRun.status}，不需要重试。`)
      return
    }
    if (!selectedRun.sourceId) {
      setMessage(`当前 ${selectedRun.type} 没有关联源对象，无法自动重试。`)
      return
    }
    setBusy('retry')
    setActionLink(null)
    try {
      if (selectedRun.type === 'connector_sync') {
        const run = await fetchActivityApi<ConnectorRunRetryDto>(`/api/connectors/${selectedRun.sourceId}/sync-runs`, {
          method: 'POST',
          body: JSON.stringify({
            rowCount: 0,
            qualityScore: 0,
            warnings: ['从运行控制台重试失败运行'],
            summary: { retryOf: selectedRun.runId, triggeredBy: 'run-console' },
          }),
        })
        setMessage(`已创建连接器重试运行：${run.connectorRunId}`)
        setActionLink({ href: runConsoleHref(run.workflowRunRef?.entityId ?? run.connectorRunId), label: '查看重试 Run' })
      } else if (selectedRun.type === 'agent_run') {
        const run = await fetchActivityApi<{ id?: string; runId?: string }>(`/api/agent/missions/${selectedRun.sourceId}/runs`, {
          method: 'POST',
          body: JSON.stringify({
            modelProvider: 'pi',
            modelName: 'sku-ready-agent',
            inputJson: { retryOf: selectedRun.runId, triggeredBy: 'run-console' },
          }),
        })
        const runId = run.runId ?? run.id ?? 'new run'
        setMessage(`已创建 Agent 重试运行：${runId}`)
        if (run.runId ?? run.id) setActionLink({ href: runConsoleHref(run.runId ?? run.id!), label: '查看重试 Run' })
      } else if (selectedRun.type === 'activity_simulation') {
        const skuProfileIds = simulationSkuProfileIds(selectedRun)
        if (!skuProfileIds.length) throw new Error('当前模拟运行没有可复用的 SKU 范围')
        const run = await fetchActivityApi<{ simulationRunId: string }>(`/api/rule-sets/${selectedRun.sourceId}/simulations`, {
          method: 'POST',
          body: JSON.stringify({ skuProfileIds }),
        })
        setMessage(`已创建规则模拟重试运行：${run.simulationRunId}`)
        setActionLink({ href: runConsoleHref(run.simulationRunId), label: '查看重试 Run' })
      } else {
        setMessage(`当前 ${selectedRun.type} 运行暂不支持自动重试。`)
      }
      await loadRuns()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重试运行失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Run History</div>
          <button className="secondaryButton" type="button" onClick={() => void loadRuns()} disabled={loading} style={{ width: '100%', height: '32px' }}>刷新运行记录</button>
        </div>
        <div className={styles.runList}>
          {runs.map((run) => (
            <button className={`${styles.runItem} ${run.runId === selectedRun?.runId ? styles.active : ''}`} key={run.runId} type="button" onClick={() => setSelectedRunId(run.runId)}>
              <div className={styles.runIdRow}>
                <span>#{shortId(run.runId)}</span>
                <span className={statusClass(run.status, styles)}>{run.status}</span>
              </div>
              <div className={styles.runMetaRow}>
                <span>{formatTime(run.startedAt ?? run.completedAt)}</span>
                <span>{run.type}</span>
              </div>
            </button>
          ))}
          {!loading && runs.length === 0 ? <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '13px' }}>暂无运行记录。</div> : null}
        </div>
      </div>

      <div className={styles.mainArea}>
        <div className={styles.mainHeader}>
          <div className={styles.runTitleInfo}>
            <div className={styles.runTitle}>{selectedRun ? `Run #${shortId(selectedRun.runId)}` : 'Run Console'}</div>
            {selectedRun ? (
              <div className={styles.runBadges}>
            <span className={`${styles.badge} ${isSucceeded(selectedRun.status) ? styles.badgeSuccess : ''}`}>状态: {selectedRun.status}</span>
            <span className={styles.badge}>类型: {selectedRun.type}</span>
            {selectedRun.sourceHref ? <a className={styles.badge} href={selectedRun.sourceHref} style={{ color: 'var(--primary)' }}>对象: {selectedRun.subject}</a> : <span className={styles.badge}>对象: {selectedRun.subject}</span>}
          </div>
            ) : null}
          </div>
          <div className={styles.headerActions}>
            <button className="secondaryButton" type="button" onClick={() => void retryRun()} disabled={!selectedRun || busy === 'retry'} style={{ height: '32px', fontSize: '13px' }}><RotateCcw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>重试失败项</button>
            <button className="secondaryButton" type="button" onClick={() => void exportLogs()} disabled={!selectedRun || busy === 'export'} style={{ height: '32px', fontSize: '13px' }}><Download size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>导出日志</button>
            <a className="iconButton" href={selectedRun?.sourceHref ?? '/agent-mission'} aria-label="打开来源对象" style={{ height: '32px', width: '32px' }}><ExternalLink size={16} /></a>
          </div>
        </div>
        {message ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px', margin: '12px 24px 0' }}>
            {message}
            {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
          </div>
        ) : null}

        <div className={styles.tabsBar}>
          {runConsoleTabs.map((tab) => (
            <button className={`${styles.tab} ${activeTab === tab.value ? styles.active : ''}`} key={tab.value} type="button" onClick={() => setActiveTab(tab.value)}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.terminalContainer}>
          {activeTab === 'timeline' ? <TimelinePanel selectedRun={selectedRun} /> : null}
          {activeTab === 'raw' ? <RawLogsPanel selectedRun={selectedRun} /> : null}
          {activeTab === 'tools' ? <ToolTracePanel selectedRun={selectedRun} /> : null}
        </div>
      </div>
    </div>
  )
}

function TimelinePanel({ selectedRun }: { selectedRun: RunConsoleItemDto | null }) {
  return (
    <div className={styles.terminalBox}>
      {selectedRun?.logs.map((log, index) => (
        <div className={styles.logLine} key={`${selectedRun.runId}:${index}`}>
          <span className={styles.logTime}>[{formatTime(log.time)}]</span>
          <span className={`${styles.logTag} ${tagClass(log.tag, styles)}`}>[{log.tag}]</span>
          <span className={styles.logContent}>{log.message}</span>
        </div>
      ))}
      {selectedRun?.logs.some((log) => log.payload) ? (
        <pre className={styles.jsonPayload}>{JSON.stringify(selectedRun.logs.filter((log) => log.payload).map((log) => log.payload), null, 2)}</pre>
      ) : null}
      {!selectedRun ? <div className={styles.logLine}><span className={styles.logContent}>No run selected.</span></div> : null}
    </div>
  )
}

function RawLogsPanel({ selectedRun }: { selectedRun: RunConsoleItemDto | null }) {
  return (
    <div className={styles.terminalBox}>
      <pre className={styles.rawJson}>{JSON.stringify(selectedRun ?? { message: 'No run selected.' }, null, 2)}</pre>
    </div>
  )
}

function ToolTracePanel({ selectedRun }: { selectedRun: RunConsoleItemDto | null }) {
  const traceLogs = selectedRun?.logs.filter((log) => log.payload || ['Agent', 'Connector', 'Workflow'].includes(log.tag)) ?? []
  return (
    <div className={styles.traceGrid}>
      {traceLogs.map((log, index) => (
        <div className={styles.traceCard} key={`${selectedRun?.runId ?? 'none'}:${index}`}>
          <div className={styles.traceHeader}>
            <span className={`${styles.logTag} ${tagClass(log.tag, styles)}`}>{log.tag}</span>
            <span>{formatTime(log.time)}</span>
          </div>
          <div className={styles.traceMessage}>{log.message}</div>
          {log.payload ? <pre className={styles.tracePayload}>{JSON.stringify(log.payload, null, 2)}</pre> : null}
        </div>
      ))}
      {traceLogs.length === 0 ? <div className={styles.emptyState}>当前运行没有工具调用或结构化 payload。</div> : null}
    </div>
  )
}

function shortId(value: string): string {
  return value.slice(0, 8)
}

function formatTime(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN')
}

function isSucceeded(status: string): boolean {
  return ['SUCCEEDED', 'SUCCESS', 'succeeded', 'completed'].includes(status)
}

function simulationSkuProfileIds(run: RunConsoleItemDto): string[] {
  const scope = run.logs.find((log) => log.tag === 'Simulation' && isRecord(log.payload))?.payload
  if (!isRecord(scope) || !Array.isArray(scope.skuProfileIds)) return []
  return scope.skuProfileIds.map(String).filter(Boolean)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFailed(status: string): boolean {
  return ['FAILED', 'failed', 'ERROR', 'CANCELED'].includes(status)
}

function getInitialRunConsoleParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function getInitialRunConsoleTab(): RunConsoleTab {
  const value = getInitialRunConsoleParam('tab')
  return value === 'raw' || value === 'tools' || value === 'timeline' ? value : 'timeline'
}

function syncRunConsoleUrl(runId: string | null | undefined, tab: RunConsoleTab) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (runId) params.set('runId', runId)
  if (tab !== 'timeline') params.set('tab', tab)
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

function runConsoleHref(runId: string, tab: RunConsoleTab = 'timeline'): string {
  const params = new URLSearchParams({ runId })
  if (tab !== 'timeline') params.set('tab', tab)
  return `/run-console?${params.toString()}`
}

function statusClass(status: string, styleMap: typeof styles): string {
  if (isSucceeded(status)) return styleMap.statusSuccess
  if (isFailed(status)) return styleMap.statusFailed
  return styleMap.statusRunning
}

function tagClass(tag: string, styleMap: typeof styles): string {
  if (tag === 'Connector') return styleMap.logTagPlugin
  if (tag === 'Data') return styleMap.logTagData
  if (tag === 'Agent') return styleMap.logTagAgent
  return styleMap.logTagSystem
}
