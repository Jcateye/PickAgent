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
  startedAt?: string
  completedAt?: string
  summary: string
  logs: Array<{ time?: string; tag: string; message: string; payload?: unknown }>
}

interface RunConsolePageDto {
  items: RunConsoleItemDto[]
  total: number
}

type RunConsoleTab = 'timeline' | 'raw' | 'tools'

const runConsoleTabs: Array<{ value: RunConsoleTab; label: string }> = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'raw', label: 'Raw Logs' },
  { value: 'tools', label: 'Tool Traces' },
]

export function RunConsolePage() {
  const [runs, setRuns] = useState<RunConsoleItemDto[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<RunConsoleTab>('timeline')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function loadRuns() {
    setLoading(true)
    try {
      const page = await fetchActivityApi<RunConsolePageDto>('/api/run-console')
      setRuns(page.items)
      setSelectedRunId((current) => current && page.items.some((item) => item.runId === current) ? current : page.items[0]?.runId ?? null)
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

  function exportLogs() {
    if (!selectedRun) return
    const content = [
      `Run ${selectedRun.runId}`,
      `Type: ${selectedRun.type}`,
      `Status: ${selectedRun.status}`,
      `Subject: ${selectedRun.subject}`,
      '',
      ...selectedRun.logs.map((log) => `[${formatTime(log.time)}] [${log.tag}] ${log.message}${log.payload ? ` ${JSON.stringify(log.payload)}` : ''}`),
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `run-${selectedRun.runId}.log`
    link.click()
    URL.revokeObjectURL(url)
    setMessage(`已导出 Run 日志：${selectedRun.runId}`)
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
    try {
      if (selectedRun.type === 'connector_sync') {
        const run = await fetchActivityApi<{ connectorRunId: string }>(`/api/connectors/${selectedRun.sourceId}/sync-runs`, {
          method: 'POST',
          body: JSON.stringify({
            rowCount: 0,
            qualityScore: 0,
            warnings: ['从运行控制台重试失败运行'],
            summary: { retryOf: selectedRun.runId, triggeredBy: 'run-console' },
          }),
        })
        setMessage(`已创建连接器重试运行：${run.connectorRunId}`)
      } else if (selectedRun.type === 'agent_run') {
        const run = await fetchActivityApi<{ id?: string; runId?: string }>(`/api/agent/missions/${selectedRun.sourceId}/runs`, {
          method: 'POST',
          body: JSON.stringify({
            modelProvider: 'pi',
            modelName: 'sku-ready-agent',
            inputJson: { retryOf: selectedRun.runId, triggeredBy: 'run-console' },
          }),
        })
        setMessage(`已创建 Agent 重试运行：${run.runId ?? run.id ?? 'new run'}`)
      } else if (selectedRun.type === 'activity_simulation') {
        const skuProfileIds = simulationSkuProfileIds(selectedRun)
        if (!skuProfileIds.length) throw new Error('当前模拟运行没有可复用的 SKU 范围')
        const run = await fetchActivityApi<{ simulationRunId: string }>(`/api/rule-sets/${selectedRun.sourceId}/simulations`, {
          method: 'POST',
          body: JSON.stringify({ skuProfileIds }),
        })
        setMessage(`已创建规则模拟重试运行：${run.simulationRunId}`)
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
                <span className={styles.badge}>对象: {selectedRun.subject}</span>
              </div>
            ) : null}
          </div>
          <div className={styles.headerActions}>
            <button className="secondaryButton" type="button" onClick={() => void retryRun()} disabled={!selectedRun || busy === 'retry'} style={{ height: '32px', fontSize: '13px' }}><RotateCcw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>重试失败项</button>
            <button className="secondaryButton" type="button" onClick={exportLogs} disabled={!selectedRun} style={{ height: '32px', fontSize: '13px' }}><Download size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>导出日志</button>
            <a className="iconButton" href="/agent-mission" style={{ height: '32px', width: '32px' }}><ExternalLink size={16} /></a>
          </div>
        </div>
        {message ? <div style={{ color: 'var(--muted)', fontSize: '13px', margin: '12px 24px 0' }}>{message}</div> : null}

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
