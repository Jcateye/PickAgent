'use client'

import { useMemo, useState } from 'react'

import { continueCopilotFixtureRun, createCopilotFixtureRun } from './agent-copilot-fixture'
import type { AgentMissionRun, AgentPlanStepStatus, WorkbenchContext } from './types'
import { useAgentRunEvents } from './use-agent-run-events'

import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

const stepBadgeVariant: Record<AgentPlanStepStatus, 'neutral' | 'ready' | 'review' | 'warning' | 'blocked'> = {
  pending: 'neutral',
  running: 'warning',
  completed: 'ready',
  waiting_for_review: 'review',
  waiting_for_data: 'blocked',
}

export function AgentCopilotWorkbench({ context, compact = false }: { context: WorkbenchContext; compact?: boolean }) {
  const [run, setRun] = useState<AgentMissionRun>(() => createCopilotFixtureRun(context))
  const [objective, setObjective] = useState(run.mission.objective)
  const runEvents = useAgentRunEvents(run.run.provider === 'eventstore' ? run.run.id : null)
  const pendingGate = run.reviewGates.find((gate) => gate.status === 'PENDING')
  const activeGate = pendingGate ?? run.reviewGates[0]
  const evidenceById = useMemo(() => new Map(run.evidenceRefs.map((item) => [item.id, item])), [run.evidenceRefs])

  function refreshFromContext() {
    const nextRun = createCopilotFixtureRun(context)
    setRun(nextRun)
    setObjective(nextRun.mission.objective)
  }

  function continueGate(decision: 'approve' | 'reject' | 'modify') {
    setRun((current) => continueCopilotFixtureRun(current, decision))
  }

  return (
    <div className={compact ? 'agentCopilotStack agentCopilotStack--compact' : 'pageStack'}>
      {!compact ? (
        <PageHeader
          title="Agent Copilot Workbench"
          description="兼容入口：同一套 Copilot overlay 组件仍可在 /agent-chat 打开。生产主入口已经收敛为 console layout 常驻 sidecar。"
          actions={
            <>
              <button className="secondaryButton" type="button" onClick={refreshFromContext}>
                读取当前 Context
              </button>
              <button className="primaryButton" type="button" onClick={() => setRun(createCopilotFixtureRun({ ...context, pageTitle: objective }))}>
                发起 Mission
              </button>
            </>
          }
        />
      ) : null}

      <Panel className="missionCommandPanel">
        <PanelHeader
          title="Mission"
          description={`Context: ${context.route}`}
          actions={<StatusBadge tone={run.run.status === 'DONE' || run.run.status === 'SUCCEEDED' ? 'ready' : 'review'}>{run.run.status}</StatusBadge>}
        />
        <PanelBody>
          <div className="missionPromptBox agentCopilotPromptBox">
            <div>
              <span className="fieldLabel">当前目标</span>
              <strong>{run.mission.objective}</strong>
              <p>
                Provider: {run.run.provider} · Contract: {run.eventContractVersion} · events: {runEvents.events.length}
              </p>
            </div>
            <label>
              <span className="fieldLabel">Mission 输入</span>
              <textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
            </label>
          </div>
          <div className="missionMetaGrid">
            <div>
              <span>页面</span>
              <strong>{context.pageTitle}</strong>
            </div>
            <div>
              <span>对象</span>
              <strong>{context.selectedEntity?.label ?? '未选择'}</strong>
            </div>
            <div>
              <span>Event stream</span>
              <strong>{runEvents.mode}</strong>
            </div>
          </div>
        </PanelBody>
      </Panel>

      <section className={compact ? 'agentCopilotSidecarGrid' : 'agentMissionLayout'}>
        <div className="pageStack">
          <Panel>
            <PanelHeader title="Messages" description="消息流只展示交互，执行路径和业务对象在其他分区。" />
            <PanelBody>
              <div className="chatStream">
                {run.messages.map((message) => (
                  <article className={`chatMessage chatMessage--${message.role === 'user' ? 'user' : 'agent'}`} key={message.id}>
                    <strong>{message.role}</strong>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Plan" description="Plan 状态由 fixture fallback 与 EventStore events 共同驱动展示。" />
            <PanelBody>
              <ol className="missionPlanList">
                {run.plan.map((step, index) => (
                  <li className={`missionPlanItem missionPlanItem--${step.status}`} key={step.id}>
                    <span className="missionStepIndex">{String(index + 1).padStart(2, '0')}</span>
                    <div className="missionStepBody">
                      <div className="missionStepTitleRow">
                        <strong>{step.title}</strong>
                        <StatusBadge tone={stepBadgeVariant[step.status]}>{step.status}</StatusBadge>
                      </div>
                      <p>{step.detail}</p>
                      {step.toolName ? <code>{step.toolName}</code> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </PanelBody>
          </Panel>
        </div>

        <div className="pageStack">
          <Panel>
            <PanelHeader title="Review Gate" description="Gate next action 必须回链 gate、review item 和 run trace。" />
            <PanelBody>
              <div className="toolTraceList">
                <div className="toolTraceItem" id={`agent-gate-${activeGate.id}`}>
                  <div className="toolTraceHeader">
                    <strong>{activeGate.question}</strong>
                    <StatusBadge tone={activeGate.status === 'PENDING' ? 'review' : activeGate.status === 'REJECTED' ? 'blocked' : 'ready'}>
                      {activeGate.status}
                    </StatusBadge>
                  </div>
                  <dl>
                    <div>
                      <dt>建议</dt>
                      <dd>{activeGate.agentRecommendation}</dd>
                    </div>
                    <div>
                      <dt>批准风险</dt>
                      <dd>{activeGate.riskIfApproved}</dd>
                    </div>
                    <div>
                      <dt>拒绝风险</dt>
                      <dd>{activeGate.riskIfRejected}</dd>
                    </div>
                  </dl>
                </div>
                <div className="agentGateLinks">
                  <a href={`#agent-gate-${activeGate.id}`}>Gate {activeGate.id}</a>
                  <a href={`/reviews?reviewItemId=${activeGate.reviewItemId ?? activeGate.id}`}>Review item</a>
                  <a href={activeGate.runTraceHref ?? `/workflows?runId=${run.run.id}`}>Run trace</a>
                  {activeGate.continuationRunId ? <a href={`/workflows?runId=${activeGate.continuationRunId}`}>Continuation run</a> : null}
                </div>
                <div className="panelActions">
                  <button className="primaryButton" type="button" disabled={!pendingGate} onClick={() => continueGate('approve')}>
                    批准继续
                  </button>
                  <button className="secondaryButton" type="button" disabled={!pendingGate} onClick={() => continueGate('modify')}>
                    修改约束
                  </button>
                  <button className="secondaryButton" type="button" disabled={!pendingGate} onClick={() => continueGate('reject')}>
                    拒绝
                  </button>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="EventStore Replay" description="断线恢复使用 lastSequence + after 参数。" />
            <PanelBody>
              <div className="eventReplayBox">
                <span>lastSequence</span>
                <strong>{runEvents.lastSequence}</strong>
                {runEvents.error ? <p>{runEvents.error}</p> : <p>Replay/SSE hook ready. 无 runId 或无事件时显示 fixture fallback。</p>}
              </div>
            </PanelBody>
          </Panel>
        </div>
      </section>

      <section className="twoColumnScaffold">
        <Panel>
          <PanelHeader title="Tool Trace" description="工具轨迹只反映 AgentToolRegistry / EventStore contract。" />
          <PanelBody>
            <div className="toolTraceList">
              {run.toolTrace.map((tool) => (
                <article className="toolTraceItem" key={tool.id}>
                  <div className="toolTraceHeader">
                    <div>
                      <strong>{tool.toolName}</strong>
                      <code>
                        {tool.riskLevel} · {tool.reviewPolicy}
                      </code>
                    </div>
                    <StatusBadge tone={tool.status === 'succeeded' ? 'ready' : 'review'}>{tool.status}</StatusBadge>
                  </div>
                  <dl>
                    <div>
                      <dt>输入</dt>
                      <dd>{tool.inputSummary}</dd>
                    </div>
                    <div>
                      <dt>输出</dt>
                      <dd>{tool.outputSummary}</dd>
                    </div>
                    <div>
                      <dt>证据</dt>
                      <dd>{tool.evidenceRefs.map((id) => evidenceById.get(id)?.label ?? id).join(' / ')}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Linked Context" description="来自页面注册的 WorkbenchContext 和 Agent linked entity。" />
          <PanelBody>
            <div className="toolTraceList">
              {run.linkedEntities.map((entity) => (
                <article className="toolTraceItem" key={entity.id}>
                  <div className="toolTraceHeader">
                    <strong>{entity.label}</strong>
                    <code>
                      {entity.entityType}:{entity.entityId}
                    </code>
                  </div>
                  <p className="mutedText">{entity.reason}</p>
                </article>
              ))}
            </div>
          </PanelBody>
        </Panel>
      </section>
    </div>
  )
}
