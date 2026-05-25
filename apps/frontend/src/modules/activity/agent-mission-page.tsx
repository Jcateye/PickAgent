'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { AgentAssistantThread } from '@/modules/agent-copilot/agent-assistant-thread'
import { useAgentRunEvents } from '@/modules/agent-copilot/use-agent-run-events'
import { StatusBadge } from '@/shared/ui/status-badge'

import styles from './agent-mission.module.css'

type MissionStatus = 'DRAFT' | 'ACTIVE' | 'PLANNING' | 'RUNNING' | 'WAITING_FOR_DATA' | 'WAITING_FOR_REVIEW' | 'COMPLETED' | 'FAILED' | 'CANCELED'
type RunStatus = 'IDLE' | 'QUEUED' | 'PREPARING_CONTEXT' | 'RUNNING' | 'STREAMING' | 'CALLING_TOOL' | 'PAUSED' | 'TIMEOUT' | 'FAILED' | 'DONE' | 'CANCELED' | 'WAITING_REVIEW' | 'SUCCEEDED'
type ToolStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED' | 'BLOCKED_BY_POLICY' | 'REVIEW_REQUIRED' | 'WAITING_FOR_APPROVAL'
type GateStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'CANCELED'

interface ApiEnvelope<T> {
  code: string
  data: T
  message?: string
}

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

const planSteps = [
  { title: '解析活动规则', detail: '读取规则版本、报名门槛和必填资料', status: 'completed' },
  { title: '检查 SKU 数据新鲜度', detail: '对照最近采集快照和字段完整性', status: 'running' },
  { title: '运行准入模拟', detail: '调用只读模拟服务生成阻断原因', status: 'pending' },
  { title: '生成 Review Gate', detail: '把人工确认项汇总到审批工作台', status: 'pending' },
] as const

export function AgentMissionPage() {
  const [missions, setMissions] = useState<MissionListItem[]>([])
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [runDetail, setRunDetail] = useState<RunDetailResponse | null>(null)
  const [objective, setObjective] = useState(defaultObjective)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const agentContext = useMemo(() => ({
    route: '/agent-mission',
    pageTitle: 'Agent Mission',
    selectedEntity: {
      entityType: 'activityRuleSet' as const,
      entityId: activeMission?.subjectId ?? 'tmall-618',
      label: activeMission?.objective ?? defaultObjective,
    },
    visibleFilters: {
      missionId: activeMission?.missionId,
      runId,
      objective,
    },
  }), [activeMission?.missionId, activeMission?.objective, activeMission?.subjectId, objective, runId])

  const loadMissionConsole = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await apiGet<MissionListResponse>('/api/agent/missions?page=1&pageSize=10')
      let nextMission = list.items[0]
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
      let nextRunId = nextMission?.currentRun?.runId
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
        inputJson: { source: 'agent-mission-console', objective },
      })
      await loadMissionConsole()
      setActiveMissionId(created.mission.id)
      setRunId(started.id ?? started.runId ?? null)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Mission 发起失败')
      setLoading(false)
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
                <p>我会围绕当前 Mission 异步调用只读工具，展示工具链、证据和需要人工确认的步骤。</p>
              </div>
              <button className="secondaryButton" type="button" onClick={startMission} disabled={loading || !objective.trim()}>
                查看任务
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

          <section className={styles.monitorSection}>
            <div className={styles.sectionTitle}>
              <strong>任务进度</strong>
              <span>{runId ? `Run ${runId}` : '新 Mission 草案'}</span>
            </div>
            <div className={styles.runSummary}>
              <div>
                <span>已完成</span>
                <strong>{planSteps.filter((step) => step.status === 'completed').length}</strong>
              </div>
              <div>
                <span>缺失证据</span>
                <strong>14</strong>
              </div>
              <div>
                <span>人工确认</span>
                <strong>{pendingGateCount}</strong>
              </div>
              <div>
                <span>冲突证据</span>
                <strong>0</strong>
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
            <button className="primaryButton" type="button" disabled={!gates.some((gate) => gate.status === 'PENDING')}>批准任务</button>
            <button className="secondaryButton" type="button" disabled={!runId}>暂停任务</button>
          </div>
        </aside>
      </main>
    </div>
  )
}

async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (envelope.code !== 'OK') throw new Error(envelope.message ?? `${url} failed`)
  return envelope.data
}

async function apiPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`)
  const envelope = (await response.json()) as ApiEnvelope<T>
  if (envelope.code !== 'OK') throw new Error(envelope.message ?? `${url} failed`)
  return envelope.data
}

function progressForRunStatus(status: RunStatus, eventCount: number): number {
  if (status === 'SUCCEEDED' || status === 'DONE') return 100
  if (status === 'FAILED' || status === 'CANCELED') return 100
  if (status === 'PAUSED' || status === 'WAITING_REVIEW') return 72
  if (status === 'RUNNING' || status === 'STREAMING' || status === 'CALLING_TOOL') return Math.min(82, 38 + eventCount * 12)
  return 38
}

function statusTone(status: MissionStatus): 'neutral' | 'ready' | 'review' | 'warning' | 'blocked' {
  if (status === 'COMPLETED') return 'ready'
  if (status === 'FAILED' || status === 'CANCELED') return 'blocked'
  if (status === 'WAITING_FOR_REVIEW') return 'review'
  if (status === 'ACTIVE' || status === 'WAITING_FOR_DATA' || status === 'RUNNING' || status === 'PLANNING') return 'warning'
  return 'neutral'
}
