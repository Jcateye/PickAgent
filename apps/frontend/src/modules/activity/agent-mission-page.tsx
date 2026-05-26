'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { AgentAssistantThread } from '@/modules/agent-copilot/agent-assistant-thread'
import { useAgentRunEvents } from '@/modules/agent-copilot/use-agent-run-events'
import { StatusBadge } from '@/shared/ui/status-badge'

import { fetchActivityApi } from './api-client'
import styles from './agent-mission.module.css'

type MissionStatus = 'DRAFT' | 'ACTIVE' | 'PLANNING' | 'RUNNING' | 'WAITING_FOR_DATA' | 'WAITING_FOR_REVIEW' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED'
type RunStatus = 'IDLE' | 'QUEUED' | 'PREPARING_CONTEXT' | 'RUNNING' | 'STREAMING' | 'CALLING_TOOL' | 'PAUSED' | 'TIMEOUT' | 'FAILED' | 'DONE' | 'CANCELED' | 'WAITING_REVIEW' | 'SUCCEEDED'
type ToolStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED' | 'BLOCKED_BY_POLICY' | 'REVIEW_REQUIRED' | 'WAITING_FOR_APPROVAL'
type GateStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'CANCELED'
type GateDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'

interface MissionListResponse {
  items: MissionListItem[]
  page: number
  pageSize: number
  total: number
}

interface MissionListItem {
  missionId: string
  objective: string
  status: MissionStatus
  sourceSurface?: string
  subjectType?: string | null
  subjectId?: string | null
  currentRun?: {
    runId: string
    status: RunStatus
    startedAt: string
    updatedAt: string
  }
  createdAt: string
  updatedAt: string
}

interface MissionCreatedResponse {
  mission: {
    id: string
    objective: string
    status: MissionStatus
    createdAt: string
    updatedAt: string
  }
}

interface MissionDetailResponse extends MissionListItem {
  runs: Array<{
    runId: string
    status: RunStatus
    startedAt?: string | null
    completedAt?: string | null
    updatedAt: string
  }>
}

interface AgentRun {
  id?: string
  runId?: string
  missionId: string
  status: RunStatus
  modelProvider?: string | null
  modelName?: string | null
  startedAt?: string
  updatedAt?: string
}

interface GateDecisionResponse {
  gate: {
    status: GateStatus
  }
  continuationRun?: AgentRun | null
}

interface RunDetailResponse {
  run: {
    runId: string
    missionId: string
    status: RunStatus
    modelProvider?: string | null
    modelName?: string | null
    startedAt: string
    updatedAt: string
    errorMessage?: string | null
  }
  mission: {
    missionId: string
    objective: string
    status: MissionStatus
  }
  toolCalls: Array<{
    toolCallId: string
    toolName: string
    status: ToolStatus
    riskLevel: 'L0' | 'L1' | 'L2' | 'L3'
    reviewPolicy: 'none' | 'review_gate' | 'AUTO_ALLOW' | 'REVIEW_GATE' | 'DENY' | string
    workflowStepId?: string | null
    evidenceRefsJson?: unknown
    errorMessage?: string | null
    blockedReason?: string | null
    updatedAt: string
  }>
  reviewGates: Array<{
    gateId: string
    status: GateStatus
    reasonCode: string
    question: string
    agentRecommendation: string
    evidenceRefsJson?: unknown
    reviewItemId?: string | null
    decidedAt?: string | null
  }>
  messages: Array<{
    messageId: string
    role: 'USER' | 'ASSISTANT' | 'TOOL' | 'SYSTEM' | string
    contentText: string
    status: string
    createdAt: string
  }>
}

const defaultObjective = '天猫 618 黄金周活动准入检查'
const sessionKey = 'agent-mission-console-default'

type PlanStepStatus = 'completed' | 'running' | 'pending'

interface PlanStep {
  title: string
  detail: string
  status: PlanStepStatus
}

export function AgentMissionPage() {
  const [missions, setMissions] = useState<MissionListItem[]>([])
  const [activeMissionId, setActiveMissionId] = useState<string | null>(() => getInitialAgentMissionParam('missionId'))
  const [runId, setRunId] = useState<string | null>(() => getInitialAgentMissionParam('runId'))
  const [runDetail, setRunDetail] = useState<RunDetailResponse | null>(null)
  const [objective, setObjective] = useState(defaultObjective)
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState<'approve' | 'modify' | 'reject' | 'pause' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<{ href: string; label: string } | null>(null)
  const runEvents = useAgentRunEvents(runId)

  const activeMission = useMemo(() => {
    const fromDetail = runDetail?.mission
    if (fromDetail) {
      return {
        missionId: fromDetail.missionId,
        objective: fromDetail.objective,
        status: fromDetail.status,
        currentRun: runDetail ? { runId: runDetail.run.runId, status: runDetail.run.status, startedAt: runDetail.run.startedAt, updatedAt: runDetail.run.updatedAt } : undefined,
        createdAt: runDetail.run.startedAt,
        updatedAt: runDetail.run.updatedAt,
      } satisfies MissionListItem
    }
    return missions.find((mission) => mission.missionId === activeMissionId) ?? missions[0]
  }, [activeMissionId, missions, runDetail])

  const progress = runDetail ? progressForRunStatus(runDetail.run.status, runEvents.events.length) : activeMission?.currentRun ? progressForRunStatus(activeMission.currentRun.status, runEvents.events.length) : 38
  const tools = runDetail?.toolCalls ?? []
  const gates = runDetail?.reviewGates ?? []
  const pendingGateCount = gates.filter((gate) => gate.status === 'PENDING').length
  const currentRunStatus = runDetail?.run.status ?? activeMission?.currentRun?.status
  const runIsTerminal = isTerminalRunStatus(currentRunStatus)
  const planSteps = useMemo(() => buildPlanSteps(runDetail, runEvents.events.length), [runDetail, runEvents.events.length])
  const completedStepCount = planSteps.filter((step) => step.status === 'completed').length
  const missingEvidenceCount = tools.filter((tool) => tool.status === 'FAILED' || tool.status === 'BLOCKED' || tool.status === 'BLOCKED_BY_POLICY').length
  const conflictEvidenceCount = gates.filter((gate) => gate.status === 'REJECTED' || gate.status === 'MODIFIED').length
  const agentContext = useMemo(() => ({
    route: '/agent-mission',
    pageTitle: 'Agent Mission',
    selectedEntity: {
      entityType: 'agentMission' as const,
      entityId: activeMission?.missionId ?? 'agent-mission',
      label: activeMission?.objective ?? defaultObjective,
    },
    visibleFilters: {
      missionId: activeMission?.missionId,
      runId,
      objective,
    },
  }), [activeMission?.missionId, activeMission?.objective, objective, runId])

  const loadMissionConsole = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const preferredMissionId = getInitialAgentMissionParam('missionId')
      const preferredRunId = getInitialAgentMissionParam('runId')
      const list = await apiGet<MissionListResponse>('/api/agent/missions?page=1&pageSize=100')
      let nextMission = preferredMissionId ? list.items.find((item) => item.missionId === preferredMissionId) : undefined
      if (!nextMission && preferredMissionId) {
        const detail = await apiGet<MissionDetailResponse>(`/api/agent/missions/${encodeURIComponent(preferredMissionId)}`)
        nextMission = missionDetailToListItem(detail)
      }
      nextMission = nextMission ?? list.items[0]
      if (!nextMission) {
        const created = await apiPost<MissionCreatedResponse>('/api/agent/missions', {
          sessionKey,
          objective: defaultObjective,
          sourceSurface: 'agent_copilot',
          subjectType: 'activity_rule_set',
          subjectId: 'tmall-618',
        })
        nextMission = {
          missionId: created.mission.id,
          objective: created.mission.objective,
          status: created.mission.status,
          sourceSurface: 'agent_copilot',
          subjectType: 'activity_rule_set',
          subjectId: 'tmall-618',
          createdAt: created.mission.createdAt,
          updatedAt: created.mission.updatedAt,
        }
      }
      setMissions(nextMission ? [nextMission, ...list.items.filter((item) => item.missionId !== nextMission.missionId)] : list.items)
      setActiveMissionId(nextMission?.missionId ?? null)
      setObjective(nextMission?.objective ?? defaultObjective)
      let nextRunId = preferredRunId ?? nextMission?.currentRun?.runId
      if (nextMission && !nextRunId) {
        const started = await apiPost<AgentRun>(`/api/agent/missions/${encodeURIComponent(nextMission.missionId)}/runs`, {
          modelProvider: 'pi',
          modelName: 'sku-ready-agent',
          inputJson: { source: 'agent-mission-console', objective: nextMission.objective },
        })
        nextRunId = started.id ?? started.runId
      }
      setRunId(nextRunId ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Agent Mission 数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    syncAgentMissionUrl(activeMission?.missionId ?? activeMissionId, runId)
  }, [activeMission?.missionId, activeMissionId, runId])

  useEffect(() => {
    void loadMissionConsole()
  }, [loadMissionConsole])

  useEffect(() => {
    if (!runId) {
      setRunDetail(null)
      return
    }
    let disposed = false
    async function loadRun() {
      try {
        const detail = await apiGet<RunDetailResponse>(`/api/agent/runs/${encodeURIComponent(runId as string)}`)
        if (!disposed) setRunDetail(detail)
      } catch (detailError) {
        if (!disposed) setError(detailError instanceof Error ? detailError.message : 'Run 详情加载失败')
      }
    }
    void loadRun()
    return () => {
      disposed = true
    }
  }, [runEvents.events.length, runId])

  async function startMission() {
    setLoading(true)
    setError(null)
    setMessage(null)
    setActionLink(null)
    try {
      const created = await apiPost<MissionCreatedResponse>('/api/agent/missions', {
        sessionKey,
        objective,
        sourceSurface: 'agent_copilot',
        subjectType: 'activity_rule_set',
        subjectId: 'tmall-618',
      })
      const started = await apiPost<AgentRun>(`/api/agent/missions/${encodeURIComponent(created.mission.id)}/runs`, {
        modelProvider: 'pi',
        modelName: 'sku-ready-agent',
        inputJson: {
          source: 'agent-mission-console',
          objective,
          requiresReviewGate: true,
          reviewGateReasonCode: 'agent_mission_console_start',
          reviewGateQuestion: '是否批准 Agent Mission 继续执行？',
          reviewGateRecommendation: '建议批准后继续创建后续 Run，并保留当前 Mission 审计上下文。',
        },
      })
      const startedRunId = runIdFromAgentRun(started)
      await loadMissionConsole()
      setActiveMissionId(created.mission.id)
      setRunId(startedRunId)
      setMessage(`已启动 Mission：${created.mission.id}${startedRunId ? ` / Run ${startedRunId}` : ''}`)
      setActionLink(startedRunId ? { href: runConsoleHref(startedRunId), label: '查看新 Run' } : { href: agentMissionHref(created.mission.id), label: '查看 Mission' })
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Mission 发起失败')
      setLoading(false)
    }
  }

  async function decidePendingGates(decision: GateDecision) {
    const pendingGates = gates.filter((gate) => gate.status === 'PENDING')
    if (!pendingGates.length) return
    const decisionMeta = gateDecisionMeta(decision)
    setActionBusy(decisionMeta.busy)
    setError(null)
    setMessage(null)
    setActionLink(null)
    try {
      const decisions = await Promise.all(pendingGates.map((gate) => apiPost<GateDecisionResponse>(`/api/agent/review-gates/${encodeURIComponent(gate.gateId)}/decision`, {
        decision,
        decidedBy: 'agent-mission-console',
        decisionComment: decisionMeta.comment,
      })))
      const continuationRunId = decisions.map((decision) => runIdFromAgentRun(decision.continuationRun ?? null)).find(Boolean) ?? runId
      if (continuationRunId) {
        const detail = await apiGet<RunDetailResponse>(`/api/agent/runs/${encodeURIComponent(continuationRunId)}`)
        setRunDetail(detail)
        setRunId(continuationRunId)
      }
      await loadMissionConsole()
      if (continuationRunId) setRunId(continuationRunId)
      setMessage(`已${decisionMeta.doneLabel} ${pendingGates.length} 个 Review Gate${continuationRunId ? `，继续 Run ${continuationRunId}` : ''}`)
      setActionLink(continuationRunId ? { href: runConsoleHref(continuationRunId), label: decision === 'APPROVE' ? '查看继续 Run' : '查看决策 Run' } : { href: '/review-approvals', label: '查看审批台' })
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : `Review Gate ${decisionMeta.doneLabel}失败`)
    } finally {
      setActionBusy(null)
    }
  }

  async function pauseCurrentRun() {
    if (!runId) return
    setActionBusy('pause')
    setError(null)
    setMessage(null)
    setActionLink(null)
    try {
      const paused = await apiPost<AgentRun>(`/api/agent/runs/${encodeURIComponent(runId)}/pause`, {
        pausedBy: 'agent-mission-console',
      })
      const pausedRunId = runIdFromAgentRun(paused) ?? runId
      const detail = await apiGet<RunDetailResponse>(`/api/agent/runs/${encodeURIComponent(pausedRunId)}`)
      setRunDetail(detail)
      await loadMissionConsole()
      setRunId(pausedRunId)
      setMessage(`已暂停 Run：${pausedRunId}`)
      setActionLink({ href: runConsoleHref(pausedRunId), label: '查看暂停 Run' })
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : 'Run 暂停失败')
    } finally {
      setActionBusy(null)
    }
  }

  async function cancelCurrentRun() {
    if (!runId) return
    setActionBusy('cancel')
    setError(null)
    setMessage(null)
    setActionLink(null)
    try {
      const canceled = await apiPost<AgentRun>(`/api/agent/runs/${encodeURIComponent(runId)}/cancel`, {
        canceledBy: 'agent-mission-console',
        reason: '从 Agent Mission 控制台取消当前运行。',
      })
      const canceledRunId = runIdFromAgentRun(canceled) ?? runId
      const detail = await apiGet<RunDetailResponse>(`/api/agent/runs/${encodeURIComponent(canceledRunId)}`)
      setRunDetail(detail)
      await loadMissionConsole()
      setRunId(canceledRunId)
      setMessage(`已取消 Run：${canceledRunId}`)
      setActionLink({ href: runConsoleHref(canceledRunId), label: '查看取消 Run' })
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Run 取消失败')
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <div className={styles.console}>
      <header className={styles.topbar}>
        <div>
          <p>任务与运行 / Agent Mission</p>
          <h1>Agent Mission（聊天式任务控制台）</h1>
        </div>
        <div className={styles.topbarActions}>
          <span className={styles.liveDot}>数据源已连接</span>
          <button className="secondaryButton" type="button" onClick={() => void loadMissionConsole()} disabled={loading}>
            刷新
          </button>
        </div>
      </header>

      <main className={styles.grid}>
        <section className={styles.workspace}>
          <div className={styles.quickActions}>
            {['检查天猫618活动规则执行计划', '检查本次活动的缺失数据', '根据 SKU 现况人工确认', '总结当前执行进度'].map((action) => (
              <button type="button" key={action} onClick={() => setObjective(action)}>
                {action}
              </button>
            ))}
          </div>

          <div className={styles.chatPanel}>
            <div className={styles.agentIntro}>
              <span className={styles.agentAvatar}>AI</span>
              <div>
                <strong>你好，我是 SKU Ready Agent</strong>
                <p>我会围绕当前 Mission 异步调用可审计工具，展示工具链、证据和需要人工确认的步骤。</p>
              </div>
              <button className="secondaryButton" type="button" onClick={startMission} disabled={loading || !objective.trim()}>
                启动任务
              </button>
            </div>

            <AgentAssistantThread
              chrome="mission"
              className={styles.embeddedAgentThread}
              context={agentContext}
              emptyDescription="输入你的问题后，我会异步读取当前 Mission / SKU / 规则上下文，不再展示硬编码示例消息。"
              emptyTitle="开始真实 Agent 对话"
            />

            <article className={styles.planCard}>
              <div className={styles.planHeader}>
                <div>
                  <strong>执行计划</strong>
                  <p>{activeMission?.objective ?? defaultObjective}</p>
                </div>
                <span>{progress}%</span>
              </div>
              <div className={styles.progressBar}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <ol className={styles.planList}>
                {planSteps.map((step, index) => (
                  <li className={styles[`step_${step.status}`]} key={step.title}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            {pendingGateCount > 0 ? (
              <article className={styles.warningCard}>
                <strong>需要确认：{pendingGateCount} 个 Review Gate 正在等待人工处理</strong>
                <a className="secondaryButton" href="/review-approvals">查看详情</a>
              </article>
            ) : null}
          </div>

          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void startMission() }}>
            <input value={objective} onChange={(event) => setObjective(event.target.value)} aria-label="Mission 目标" />
            <button className={styles.sendButton} type="submit" disabled={loading || !objective.trim()}>
              启动 Mission
            </button>
          </form>
        </section>

        <aside className={styles.monitor}>
          <div className={styles.monitorHeader}>
            <div>
              <span>运行监控</span>
              <strong>{activeMission?.objective ?? defaultObjective}</strong>
            </div>
            <StatusBadge tone={statusTone(activeMission?.status ?? 'RUNNING')}>{activeMission?.status ?? 'RUNNING'}</StatusBadge>
          </div>

          {error ? <div className={styles.errorBox}>{error}</div> : null}
          {message ? (
            <div className={styles.resultBox}>
              <span>{message}</span>
              {actionLink ? <a href={actionLink.href}>{actionLink.label}</a> : null}
            </div>
          ) : null}

          <section className={styles.monitorSection}>
            <div className={styles.sectionTitle}>
              <strong>任务进度</strong>
              <span>{runId ? <a href={runConsoleHref(runId)}>Run {runId}</a> : '新 Mission 草案'}</span>
            </div>
            <div className={styles.runSummary}>
              <div>
                <span>已完成</span>
                <strong>{completedStepCount}</strong>
              </div>
              <div>
                <span>缺失证据</span>
                <strong>{missingEvidenceCount}</strong>
              </div>
              <div>
                <span>人工确认</span>
                <strong>{pendingGateCount}</strong>
              </div>
              <div>
                <span>冲突证据</span>
                <strong>{conflictEvidenceCount}</strong>
              </div>
            </div>
          </section>

          <section className={styles.monitorSection}>
            <div className={styles.sectionTitle}>
              <strong>工具调用</strong>
              <span>events {runEvents.events.length}</span>
            </div>
            <div className={styles.toolList}>
              {tools.length ? tools.map((tool) => (
                <article key={tool.toolCallId}>
                  <div>
                    <strong>{tool.toolName}</strong>
                    <span>{tool.riskLevel} · {tool.reviewPolicy}</span>
                  </div>
                  <StatusBadge tone={tool.status === 'SUCCEEDED' ? 'ready' : tool.status === 'FAILED' ? 'blocked' : 'review'}>{tool.status}</StatusBadge>
                </article>
              )) : <p className={styles.emptyMonitorText}>发送对话后，这里会显示真实工具调用。</p>}
            </div>
          </section>

          <section className={styles.monitorSection}>
            <div className={styles.sectionTitle}>
              <strong>Review Gate</strong>
              <span>人工审批</span>
            </div>
            <div className={styles.gateList}>
              {gates.length ? gates.map((gate) => (
                <article key={gate.gateId}>
                  <div>
                    <strong>{gate.question}</strong>
                    <p>{gate.agentRecommendation}</p>
                  </div>
                  <StatusBadge tone={gate.status === 'PENDING' ? 'review' : gate.status === 'REJECTED' ? 'blocked' : 'ready'}>{gate.status}</StatusBadge>
                </article>
              )) : <p className={styles.emptyMonitorText}>暂无 Review Gate。</p>}
            </div>
          </section>

          <section className={styles.monitorSection}>
            <div className={styles.sectionTitle}>
              <strong>证据与事件</strong>
              <span>{runEvents.mode}</span>
            </div>
            <div className={styles.evidenceList}>
              <div><span>EventStore replay</span><strong>#{runEvents.lastSequence}</strong></div>
              <div><span>Run events</span><strong>{runEvents.events.length}</strong></div>
              <div><span>Workbench context</span><strong>{agentContext.selectedEntity.entityType}:{agentContext.selectedEntity.entityId}</strong></div>
            </div>
          </section>

          <div className={styles.monitorActions}>
            <button className="primaryButton" type="button" onClick={() => void decidePendingGates('APPROVE')} disabled={!!actionBusy || !gates.some((gate) => gate.status === 'PENDING')}>批准任务</button>
            <button className="secondaryButton" type="button" onClick={() => void decidePendingGates('REQUEST_CHANGES')} disabled={!!actionBusy || !gates.some((gate) => gate.status === 'PENDING')}>要求修改</button>
            <button className="secondaryButton" type="button" onClick={() => void decidePendingGates('REJECT')} disabled={!!actionBusy || !gates.some((gate) => gate.status === 'PENDING')}>驳回任务</button>
            <button className="secondaryButton" type="button" onClick={() => void pauseCurrentRun()} disabled={!!actionBusy || !runId || runIsTerminal}>暂停任务</button>
            <button className="secondaryButton" type="button" onClick={() => void cancelCurrentRun()} disabled={!!actionBusy || !runId || runIsTerminal}>取消任务</button>
          </div>
        </aside>
      </main>
    </div>
  )
}

function missionDetailToListItem(detail: MissionDetailResponse): MissionListItem {
  const currentRun = detail.currentRun ?? detail.runs[0]
  return {
    missionId: detail.missionId,
    objective: detail.objective,
    status: detail.status,
    sourceSurface: detail.sourceSurface,
    subjectType: detail.subjectType,
    subjectId: detail.subjectId,
    currentRun: currentRun ? {
      runId: currentRun.runId,
      status: currentRun.status,
      startedAt: currentRun.startedAt ?? currentRun.updatedAt,
      updatedAt: currentRun.updatedAt,
    } : undefined,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  }
}

function getInitialAgentMissionParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function syncAgentMissionUrl(missionId: string | null | undefined, runId: string | null | undefined) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (missionId) params.set('missionId', missionId)
  if (runId) params.set('runId', runId)
  const nextSearch = params.toString()
  const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

function runIdFromAgentRun(run: AgentRun | null | undefined): string | null {
  return run?.id ?? run?.runId ?? null
}

function runConsoleHref(runId: string): string {
  return `/run-console?${new URLSearchParams({ runId }).toString()}`
}

function agentMissionHref(missionId: string, runId?: string | null): string {
  const params = new URLSearchParams({ missionId })
  if (runId) params.set('runId', runId)
  return `/agent-mission?${params.toString()}`
}

function gateDecisionMeta(decision: GateDecision): { busy: 'approve' | 'modify' | 'reject'; comment: string; doneLabel: string } {
  if (decision === 'REJECT') {
    return {
      busy: 'reject',
      comment: '从 Agent Mission 控制台驳回当前 Review Gate。',
      doneLabel: '驳回',
    }
  }
  if (decision === 'REQUEST_CHANGES') {
    return {
      busy: 'modify',
      comment: '从 Agent Mission 控制台要求修改后再继续。',
      doneLabel: '要求修改',
    }
  }
  return {
    busy: 'approve',
    comment: '从 Agent Mission 控制台批准继续。',
    doneLabel: '批准',
  }
}

async function apiGet<T>(url: string): Promise<T> {
  return fetchActivityApi<T>(url, { headers: { Accept: 'application/json' } })
}

async function apiPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  return fetchActivityApi<T>(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

function progressForRunStatus(status: RunStatus, eventCount: number): number {
  if (status === 'SUCCEEDED' || status === 'DONE') return 100
  if (status === 'FAILED' || status === 'CANCELED') return 100
  if (status === 'PAUSED' || status === 'WAITING_REVIEW') return 72
  if (status === 'RUNNING' || status === 'STREAMING' || status === 'CALLING_TOOL') return Math.min(82, 38 + eventCount * 12)
  return 38
}

function isTerminalRunStatus(status?: RunStatus): boolean {
  return status === 'SUCCEEDED' || status === 'DONE' || status === 'FAILED' || status === 'CANCELED'
}

function buildPlanSteps(runDetail: RunDetailResponse | null, eventCount: number): PlanStep[] {
  const tools = runDetail?.toolCalls ?? []
  const gates = runDetail?.reviewGates ?? []
  const hasTool = (pattern: RegExp) => tools.some((tool) => pattern.test(tool.toolName))
  const hasSucceededTool = (pattern: RegExp) => tools.some((tool) => pattern.test(tool.toolName) && tool.status === 'SUCCEEDED')
  const runStatus = runDetail?.run.status
  const isTerminal = isTerminalRunStatus(runStatus)
  const isRunning = Boolean(runStatus && !isTerminal)
  return [
    {
      title: '建立 Mission 上下文',
      detail: runDetail ? `Mission ${runDetail.mission.missionId} / Run ${runDetail.run.runId}` : '等待创建或加载真实 Mission',
      status: runDetail ? 'completed' : 'running',
    },
    {
      title: '读取业务上下文',
      detail: tools.length ? `已记录 ${tools.length} 个工具调用` : `${eventCount} 个运行事件，等待工具调用`,
      status: tools.length ? 'completed' : isRunning || eventCount > 0 ? 'running' : 'pending',
    },
    {
      title: '执行 SKU / 规则 / 活动工具',
      detail: tools.length ? tools.slice(0, 3).map((tool) => `${tool.toolName}:${tool.status}`).join('；') : '发送对话后由 Agent 调用系统工具',
      status: hasSucceededTool(/Sku|Rule|Activity|Report|Connector|Review|Dashboard|search|list|generate|simulate|diagnose|check|create|update|start/i) ? 'completed' : tools.length ? 'running' : 'pending',
    },
    {
      title: '处理 Review Gate',
      detail: gates.length ? `${gates.length} 个 Gate，待处理 ${gates.filter((gate) => gate.status === 'PENDING').length} 个` : '暂无需要人工确认的 Gate',
      status: gates.some((gate) => gate.status === 'PENDING') ? 'running' : gates.length ? 'completed' : hasTool(/Review|decide/i) ? 'completed' : 'pending',
    },
    {
      title: '沉淀证据与结果',
      detail: runDetail ? `消息 ${runDetail.messages.length} 条，事件 ${eventCount} 条` : '等待 Agent 输出可追溯结果',
      status: isTerminal ? 'completed' : runDetail ? 'running' : 'pending',
    },
  ]
}

function statusTone(status: MissionStatus): 'neutral' | 'ready' | 'review' | 'warning' | 'blocked' {
  if (status === 'COMPLETED') return 'ready'
  if (status === 'FAILED' || status === 'CANCELED') return 'blocked'
  if (status === 'WAITING_FOR_REVIEW') return 'review'
  if (status === 'ACTIVE' || status === 'WAITING_FOR_DATA' || status === 'RUNNING' || status === 'PLANNING' || status === 'PAUSED') return 'warning'
  return 'neutral'
}
