'use client'

import { useEffect, useState } from 'react'

import { useAgentRunEvents } from './use-agent-run-events'
import type { AgentEvidenceRef, AgentLinkedEntity, AgentMessage, AgentReviewGate, AgentToolTrace, WorkbenchContext } from './types'

import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

interface ChatTurnMeta {
  assistantMessageId: string
  toolTrace: AgentToolTrace[]
  evidenceRefs: AgentEvidenceRef[]
  linkedEntities: AgentLinkedEntity[]
  reviewGate: AgentReviewGate | null
  runId: string
  fallbackUsed: boolean
}

interface ChatResponse {
  missionId: string
  runId: string
  assistantMessage: AgentMessage
  toolTrace: AgentToolTrace[]
  evidenceRefs: AgentEvidenceRef[]
  linkedEntities: AgentLinkedEntity[]
  reviewGate: AgentReviewGate | null
  fallbackUsed: boolean
}

interface SessionMessagesResponse {
  items: Array<AgentMessage & { runId?: string | null; createdAt?: string }>
}

export function AgentCopilotChatShell({ context, compact = false }: { context: WorkbenchContext; compact?: boolean }) {
  const [sessionKey] = useState(() => stableSessionKey(context))
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [turns, setTurns] = useState<Record<string, ChatTurnMeta>>({})
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runEvents = useAgentRunEvents(activeRunId)

  useEffect(() => {
    let disposed = false
    async function recover() {
      try {
        const response = await fetch(`/api/agent/sessions/${encodeURIComponent(sessionKey)}/messages?limit=50`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        })
        if (!response.ok) return
        const envelope = (await response.json()) as { code: string; data?: SessionMessagesResponse }
        if (disposed || envelope.code !== 'OK' || !envelope.data) return
        setMessages(envelope.data.items.map((item) => ({
          id: item.id,
          role: item.role,
          content: item.content,
          status: item.status,
          linkedEntityIds: item.linkedEntityIds,
          evidenceRefIds: item.evidenceRefIds,
        })))
        const latestRunId = envelope.data.items.findLast((item) => item.runId)?.runId
        if (latestRunId) setActiveRunId(latestRunId)
      } catch {
        // Recovery is best-effort; sending a new message will surface hard failures.
      }
    }
    void recover()
    return () => {
      disposed = true
    }
  }, [sessionKey])

  async function submit() {
    const content = draft.trim()
    if (!content || isSubmitting) return

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      status: 'completed',
    }
    const placeholderId = `assistant-pending-${Date.now()}`

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: placeholderId,
        role: 'assistant',
        content: '正在理解你的意图并选择合适的业务工具…',
        status: 'streaming',
      },
    ])
    setDraft('')
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionKey,
          message: content,
          context,
        }),
      })
      const envelope = (await response.json()) as { code: string; message: string; data?: ChatResponse }
      if (!response.ok || envelope.code !== 'OK' || !envelope.data) {
        throw new Error(envelope.message || `Agent chat failed: ${response.status}`)
      }
      const data = envelope.data

      setActiveRunId(data.runId)
      setMessages((current) => current.map((item) => (item.id === placeholderId ? data.assistantMessage : item)))
      setTurns((current) => ({
        ...current,
        [data.assistantMessage.id]: {
          assistantMessageId: data.assistantMessage.id,
          toolTrace: data.toolTrace,
          evidenceRefs: data.evidenceRefs,
          linkedEntities: data.linkedEntities,
          reviewGate: data.reviewGate,
          runId: data.runId,
          fallbackUsed: data.fallbackUsed,
        },
      }))
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Agent Copilot 暂时不可用'
      setMessages((current) =>
        current.map((item) =>
          item.id === placeholderId
            ? {
                id: `assistant-error-${Date.now()}`,
                role: 'assistant',
                content: `当前无法完成真实对话请求：${message}`,
                status: 'completed',
              }
            : item,
        ),
      )
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={compact ? 'agentChatShell agentChatShell--compact' : 'pageStack'}>
      {!compact ? (
        <PageHeader
          title="Agent Copilot"
          description="像 ChatGPT 一样先对话，只有在你真正提出问题后，系统才开始回复、调工具和展示证据。"
        />
      ) : null}

      <Panel className="agentChatPanel">
        <PanelHeader
          title="Conversation"
          description={context.pageTitle}
          actions={activeRunId ? <StatusBadge tone="ready">{runEvents.mode}</StatusBadge> : <StatusBadge tone="neutral">idle</StatusBadge>}
        />
        <PanelBody className="agentChatPanelBody">
          {messages.length === 0 ? (
            <div className="agentChatEmptyState">
              <strong>从一个问题开始</strong>
              <p>直接提问活动规则、当前 SKU 健康、证据解释或下一步建议。没有用户输入前，不会预先生成任何对话。</p>
              <div className="agentChatContextPill">
                <span>Context</span>
                <strong>{context.selectedEntity?.label ?? context.pageTitle}</strong>
              </div>
            </div>
          ) : (
            <div className="chatStream">
              {messages.map((message) => {
                const turn = turns[message.id]
                return (
                  <article className={`chatMessage chatMessage--${message.role === 'user' ? 'user' : 'agent'}`} key={message.id}>
                    <strong>{message.role === 'user' ? 'You' : 'Copilot'}</strong>
                    <p>{message.content}</p>
                    {turn ? (
                      <details className="agentChatDetails">
                        <summary>查看本轮工具与证据</summary>
                        <div className="agentChatDetailsBody">
                          {turn.fallbackUsed ? <p className="agentChatFallback">当前结果来自 fallback，而不是真实对话路径。</p> : null}
                          {turn.toolTrace.length ? (
                            <div className="toolTraceList">
                              {turn.toolTrace.map((tool) => (
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
                                  </dl>
                                </article>
                              ))}
                            </div>
                          ) : null}
                          {turn.evidenceRefs.length ? (
                            <div className="evidenceList">
                              {turn.evidenceRefs.map((item) => (
                                <article className="evidenceItem" key={item.id}>
                                  <span>{item.label}</span>
                                  <p>{item.summary}</p>
                                </article>
                              ))}
                            </div>
                          ) : null}
                          {turn.reviewGate ? (
                            <article className="toolTraceItem">
                              <div className="toolTraceHeader">
                                <strong>{turn.reviewGate.question}</strong>
                                <StatusBadge tone="review">{turn.reviewGate.status}</StatusBadge>
                              </div>
                              <p>{turn.reviewGate.agentRecommendation}</p>
                            </article>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}

          <div className="agentChatComposer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submit()
                }
              }}
              placeholder="输入你的问题，例如：解释这段活动规则；分析当前 SKU 为什么不 Ready；结合证据给我建议。"
            />
            <div className="agentChatComposerFooter">
              <div className="agentChatContextPill">
                <span>Context</span>
                <strong>{context.selectedEntity?.label ?? context.pageTitle}</strong>
              </div>
              <button className="primaryButton" type="button" disabled={isSubmitting || !draft.trim()} onClick={() => void submit()}>
                发送
              </button>
            </div>
          </div>

          {error ? <p className="agentChatError">错误：{error}</p> : null}
          {activeRunId ? <p className="agentChatMeta">runId: {activeRunId} · events: {runEvents.events.length} · mode: {runEvents.mode}</p> : null}
        </PanelBody>
      </Panel>
    </div>
  )
}

function stableSessionKey(context: WorkbenchContext): string {
  const storageKey = 'pickagent.agentCopilot.sessionKey'
  if (typeof window === 'undefined') return `agent-chat-${context.route || 'server'}`
  const existing = window.localStorage.getItem(storageKey)
  if (existing) return existing
  const route = context.route.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'console'
  const key = `agent-chat-local-${route}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(storageKey, key)
  return key
}
