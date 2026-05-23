'use client'

import { useMemo, useState } from 'react'

import type { AgentMissionRun, AgentPlanStepStatus } from './agent-copilot-contract'
import { continueFakeAgentMissionRun, createFakeAgentMissionRun } from './agent-copilot-fixture'

import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

const defaultObjective = '请复核 Summer Promo 中 SKU-A17 的活动准入状态，说明证据，并在高风险动作前暂停让我确认。'

const stepBadgeVariant: Record<AgentPlanStepStatus, 'neutral' | 'ready' | 'review' | 'warning' | 'blocked'> = {
  pending: 'neutral',
  running: 'warning',
  completed: 'ready',
  waiting_for_review: 'review',
  waiting_for_data: 'blocked',
}

export function AgentChatPage() {
  const [objective, setObjective] = useState(defaultObjective)
  const [run, setRun] = useState<AgentMissionRun>(() => createFakeAgentMissionRun(defaultObjective))

  const pendingGate = run.reviewGates.find((gate) => gate.status === 'PENDING')
  const activeGate = pendingGate ?? run.reviewGates[0]
  const evidenceById = useMemo(() => new Map(run.evidenceRefs.map((item) => [item.id, item])), [run.evidenceRefs])

  function startMission() {
    setRun(createFakeAgentMissionRun(objective.trim() || defaultObjective))
  }

  function decideGate(decision: 'approve' | 'reject' | 'modify') {
    setRun((currentRun) => continueFakeAgentMissionRun(currentRun, decision))
  }

  return (
    <div className="pageStack">
      <PageHeader
        title="Agent Copilot Workbench"
        description="以 Mission 为中心展示 fake run 的消息流、Plan、Tool Trace、Linked Context、Evidence 与 Review Gate。当前仅使用 mock event/provider，不接入真实 Pi 或业务数据库。"
        actions={
          <>
            <button className="secondaryButton" type="button" onClick={() => setObjective(defaultObjective)}>
              重置输入
            </button>
            <button className="primaryButton" type="button" onClick={startMission}>
              发起 Mission
            </button>
          </>
        }
      />

      <section className="agentMissionLayout">
        <div className="pageStack">
          <Panel className="missionCommandPanel">
            <PanelHeader title="Mission" description="Mission、Run 与 mock event contract 的当前状态。" />
            <PanelBody>
              <div className="missionPromptBox">
                <div>
                  <span className="fieldLabel">当前目标</span>
                  <strong>{run.mission.objective}</strong>
                  <p>Provider: {run.run.provider} · Contract: {run.eventContractVersion}</p>
                </div>
                <label>
                  <span className="fieldLabel">继续输入或重新发起</span>
                  <textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
                </label>
              </div>
              <div className="missionMetaGrid">
                <div>
                  <span>Mission 状态</span>
                  <strong>{run.mission.status}</strong>
                </div>
                <div>
                  <span>Run 状态</span>
                  <strong>{run.run.status}</strong>
                </div>
                <div>
                  <span>自治等级</span>
                  <strong>{run.mission.autonomyLevel}</strong>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Messages" description="消息流只承载交互叙事，执行路径放到 Plan、Trace 和 Evidence 面板。" />
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
            <PanelHeader title="Plan" description="fake event stream 推动同一组 plan step 状态变化。" />
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

        <aside className="pageStack">
          <Panel>
            <PanelHeader title="Run Meter" description="长任务运行状态和下一步入口。" />
            <PanelBody>
              <div className="missionRunMeter">
                <span>fake run progress</span>
                <strong>{run.run.progressPercent}%</strong>
                <div className="missionRunBar" aria-label={`run progress ${run.run.progressPercent}%`}>
                  <span style={{ width: `${run.run.progressPercent}%` }} />
                </div>
                <ul className="nextActionList">
                  {run.nextActions.map((action, index) => (
                    <li key={action}>
                      <span>{index + 1}</span>
                      <p>{action}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Review Gate" description="L2 风险暂停点，决策后继续同一 Mission。" />
            <PanelBody>
              <div className="toolTraceList">
                <div className="toolTraceItem">
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
                <div className="panelActions">
                  <button className="primaryButton" type="button" disabled={!pendingGate} onClick={() => decideGate('approve')}>
                    批准继续
                  </button>
                  <button className="secondaryButton" type="button" disabled={!pendingGate} onClick={() => decideGate('modify')}>
                    修改约束
                  </button>
                  <button className="secondaryButton" type="button" disabled={!pendingGate} onClick={() => decideGate('reject')}>
                    拒绝
                  </button>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Tool Trace" description="所有 fake tool 都表示为 AgentToolRegistry 边界后的工具调用。" />
            <PanelBody>
              <div className="toolTraceList">
                {run.toolTrace.map((tool) => (
                  <article className="toolTraceItem" key={tool.id}>
                    <div className="toolTraceHeader">
                      <div>
                        <strong>{tool.toolName}</strong>
                        <code>{tool.riskLevel} · {tool.reviewPolicy}</code>
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
        </aside>
      </section>

      <section className="twoColumnScaffold">
        <Panel>
          <PanelHeader title="Linked Context" description="Context link 用稳定 entityType/entityId 关联消息、工具和 Gate。" />
          <PanelBody>
            <div className="toolTraceList">
              {run.linkedEntities.map((entity) => (
                <article className="toolTraceItem" key={entity.id}>
                  <div className="toolTraceHeader">
                    <strong>{entity.label}</strong>
                    <code>{entity.entityType}:{entity.entityId}</code>
                  </div>
                  <dl>
                    <div>
                      <dt>来源</dt>
                      <dd>{entity.sourceType}:{entity.sourceId}</dd>
                    </div>
                    <div>
                      <dt>原因</dt>
                      <dd>{entity.reason}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Evidence" description="Evidence 只做摘要与引用，不把业务真相写进聊天文本。" />
          <PanelBody>
            <div className="toolTraceList">
              {run.evidenceRefs.map((evidence) => (
                <article className="toolTraceItem" key={evidence.id}>
                  <div className="toolTraceHeader">
                    <strong>{evidence.label}</strong>
                    <code>{evidence.evidenceType}</code>
                  </div>
                  <p className="mutedText">{evidence.summary}</p>
                </article>
              ))}
            </div>
          </PanelBody>
        </Panel>
      </section>
    </div>
  )
}
