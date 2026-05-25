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
  startedAt?: string
  completedAt?: string
  summary: string
  logs: Array<{ time?: string; tag: string; message: string; payload?: unknown }>
}

interface RunConsolePageDto {
  items: RunConsoleItemDto[]
  total: number
}

export function RunConsolePage() {
  const [runs, setRuns] = useState<RunConsoleItemDto[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  function retryRun() {
    if (!selectedRun) return
    if (!isFailed(selectedRun.status)) {
      setMessage(`当前 Run 状态为 ${selectedRun.status}，不需要重试。`)
      return
    }
    setMessage('失败重试会创建新的 connector sync 或 agent run；请从对应业务页面发起。')
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
            <button className="secondaryButton" type="button" onClick={retryRun} disabled={!selectedRun} style={{ height: '32px', fontSize: '13px' }}><RotateCcw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>重试失败项</button>
            <button className="secondaryButton" type="button" onClick={exportLogs} disabled={!selectedRun} style={{ height: '32px', fontSize: '13px' }}><Download size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>导出日志</button>
            <a className="iconButton" href="/agent-mission" style={{ height: '32px', width: '32px' }}><ExternalLink size={16} /></a>
          </div>
        </div>
        {message ? <div style={{ color: 'var(--muted)', fontSize: '13px', margin: '12px 24px 0' }}>{message}</div> : null}

        <div className={styles.tabsBar}>
          <div className={`${styles.tab} ${styles.active}`}>Timeline</div>
          <div className={styles.tab}>Raw Logs</div>
          <div className={styles.tab}>Tool Traces</div>
        </div>

        <div className={styles.terminalContainer}>
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
        </div>
      </div>
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
