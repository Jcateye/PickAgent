'use client'

import { AssistantRuntimeProvider, ComposerPrimitive, useExternalStoreRuntime } from '@assistant-ui/react'
import { Bot, CheckCircle2, ChevronRight, Cpu, Sparkles, User, Wrench, Zap } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useAgentRunEvents } from './use-agent-run-events'
import type { AgentEvidenceRef, AgentLinkedEntity, AgentMessage, AgentReviewGate, AgentToolTrace, WorkbenchContext } from './types'

import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

let inMemorySessionKey: string | null = null

interface ChatTurnMeta {
  assistantMessageId: string
  toolTrace: AgentToolTrace[]
  evidenceRefs: AgentEvidenceRef[]
  linkedEntities: AgentLinkedEntity[]
  reviewGate: AgentReviewGate | null
  runId: string
  fallbackUsed: boolean
  thoughts: string[]
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

interface SessionMessage extends AgentMessage {
  runId?: string | null
  createdAt?: string
  turn?: Omit<ChatTurnMeta, 'assistantMessageId'>
}

interface SessionMessagesResponse {
  items: SessionMessage[]
}

interface AgentAssistantThreadProps {
  context: WorkbenchContext
  compact?: boolean
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
  chrome?: 'panel' | 'mission'
  className?: string
}

export function AgentAssistantThread({
  context,
  compact = false,
  title = 'Conversation',
  description,
  emptyTitle = '从一个问题开始',
  emptyDescription = '直接提问活动规则、当前 SKU 健康、证据解释或下一步建议。没有用户输入前，不会预先生成任何对话。',
  chrome = 'panel',
  className,
}: AgentAssistantThreadProps) {
  const [sessionKey] = useState(() => stableSessionKey(context))
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [turns, setTurns] = useState<Record<string, ChatTurnMeta>>({})
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runEvents = useAgentRunEvents(activeRunId)
  const runtime = useExternalStoreRuntime<AgentMessage>({
    messages,
    isRunning: isSubmitting,
    isSendDisabled: isSubmitting,
    setMessages: (nextMessages) => setMessages([...nextMessages]),
    convertMessage: (message) => {
      const role: 'user' | 'system' | 'assistant' = message.role === 'user' || message.role === 'system' ? message.role : 'assistant'
      const converted = {
        id: message.id,
        role,
        content: message.content,
        metadata: { custom: { linkedEntityIds: message.linkedEntityIds ?? [], evidenceRefIds: message.evidenceRefIds ?? [] } },
      }
      return role === 'assistant'
        ? { ...converted, status: message.status === 'streaming' ? { type: 'running' as const } : { type: 'complete' as const, reason: 'stop' as const } }
        : converted
    },
    onNew: async (message) => {
      const content = extractComposerText(message)
      if (content) await submitMessage(content)
    },
  })

  useEffect(() => {
    let disposed = false
    async function recover() {
      try {
        const response = await fetch(`/api/agent/sessions/${encodeURIComponent(sessionKey)}/messages?limit=50`, {
          headers: apiHeaders(sessionKey),
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
        setTurns(Object.fromEntries(envelope.data.items.flatMap((item) => item.turn ? [[item.id, { assistantMessageId: item.id, ...item.turn } satisfies ChatTurnMeta]] : [])))
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

  async function submitMessage(content: string) {
    const text = content.trim()
    if (!text || isSubmitting) return
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      status: 'completed',
    }
    const placeholderId = `assistant-pending-${Date.now()}`

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: placeholderId,
        role: 'assistant',
        content: '正在理解你的意图、整理上下文并选择可审计的业务工具…',
        status: 'streaming',
      },
    ])
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: apiHeaders(sessionKey),
        body: JSON.stringify({ sessionKey, message: text, context }),
      })
      const envelope = (await response.json()) as { code: string; message: string; data?: ChatResponse }
      if (!response.ok || envelope.code !== 'OK' || !envelope.data) {
        throw new Error(envelope.message || `Agent chat failed: ${response.status}`)
      }
      const data = envelope.data
      const turn = toTurnMeta(data)

      setActiveRunId(data.runId)
      setMessages((current) => current.map((item) => (item.id === placeholderId ? data.assistantMessage : item)))
      setTurns((current) => ({ ...current, [data.assistantMessage.id]: turn }))
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

  const body = (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadBody
        activeRunId={activeRunId}
        chrome={chrome}
        context={context}
        emptyDescription={emptyDescription}
        emptyTitle={emptyTitle}
        error={error}
        isSubmitting={isSubmitting}
        messages={messages}
        runEvents={runEvents}
        sessionKey={sessionKey}
        turns={turns}
      />
    </AssistantRuntimeProvider>
  )

  if (chrome === 'mission') {
    return <div className={className}>{body}</div>
  }

  return (
    <div className={compact ? 'agentChatShell agentChatShell--compact' : 'pageStack'}>
      {!compact ? <PageHeader title="Agent Copilot" description="统一 Agent 对话流，支持工具链、证据和人工交互卡片。" /> : null}
      <Panel className="agentChatPanel">
        <PanelHeader
          title={title}
          description={description ?? context.pageTitle}
          actions={activeRunId ? <StatusBadge tone="ready">{runEvents.mode}</StatusBadge> : <StatusBadge tone="neutral">idle</StatusBadge>}
        />
        <PanelBody className="agentChatPanelBody">{body}</PanelBody>
      </Panel>
    </div>
  )
}

function ThreadBody({
  activeRunId,
  chrome,
  context,
  emptyDescription,
  emptyTitle,
  error,
  isSubmitting,
  messages,
  runEvents,
  sessionKey,
  turns,
}: {
  activeRunId: string | null
  chrome: 'panel' | 'mission'
  context: WorkbenchContext
  emptyDescription: string
  emptyTitle: string
  error: string | null
  isSubmitting: boolean
  messages: AgentMessage[]
  runEvents: ReturnType<typeof useAgentRunEvents>
  sessionKey: string
  turns: Record<string, ChatTurnMeta>
}) {
  return (
    <>
      <div className={chrome === 'mission' ? 'agentMissionThreadViewport' : undefined}>
        {messages.length === 0 ? (
          <div className="agentChatEmptyState">
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
            <div className="agentChatContextPill">
              <span>Context</span>
              <strong>{context.selectedEntity?.label ?? context.pageTitle}</strong>
            </div>
          </div>
        ) : (
          <div className={chrome === 'mission' ? 'agentMissionChatStream' : 'chatStream'}>
            {messages.map((message) => <AgentMessageCard key={message.id} message={message} turn={turns[message.id]} />)}
          </div>
        )}
      </div>

      <ComposerPrimitive.Root className={chrome === 'mission' ? 'agentMissionComposer' : 'agentChatComposer'}>
        <ComposerPrimitive.Input
          className={chrome === 'mission' ? 'agentMissionComposerInput' : undefined}
          placeholder="Reply to SKU Ready Agent..."
          rows={chrome === 'mission' ? 1 : 4}
        />
        <div className={chrome === 'mission' ? 'agentMissionComposerFooter' : 'agentChatComposerFooter'}>
          <div className="agentChatContextPill">
            <span>Context</span>
            <strong>{context.selectedEntity?.label ?? context.pageTitle}</strong>
          </div>
          <ComposerPrimitive.Send className={chrome === 'mission' ? 'agentMissionSendButton' : 'primaryButton'} disabled={isSubmitting}>
            {chrome === 'mission' ? <ChevronRight size={16} /> : '发送'}
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>

      {error ? <p className="agentChatError">错误：{error}</p> : null}
      {activeRunId ? <p className="agentChatMeta">runId: {activeRunId} · events: {runEvents.events.length} · mode: {runEvents.mode} · session: {sessionKey}</p> : null}
    </>
  )
}

function AgentMessageCard({ message, turn }: { message: AgentMessage; turn?: ChatTurnMeta }) {
  const isUser = message.role === 'user'
  return (
    <article className={`agentMessageFrame agentMessageFrame--${isUser ? 'user' : 'assistant'}`}>
      <div className={`agentMessageAvatar agentMessageAvatar--${isUser ? 'user' : 'assistant'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="agentMessageStack">
        <div className={`agentMessageBubble agentMessageBubble--${isUser ? 'user' : 'assistant'}`}>
          <strong>{isUser ? 'You' : 'SKU Ready Agent'}</strong>
          <p>{message.content}</p>
        </div>
        {turn ? <AgentTurnCards turn={turn} /> : null}
      </div>
    </article>
  )
}

function AgentTurnCards({ turn }: { turn: ChatTurnMeta }) {
  return (
    <div className="agentTurnCards">
      {turn.thoughts.length ? (
        <section className="agentThoughtCard">
          <div className="agentCardTitle">
            <Sparkles size={14} />
            <strong>思考过程</strong>
          </div>
          <ol>
            {turn.thoughts.map((thought) => <li key={thought}>{thought}</li>)}
          </ol>
        </section>
      ) : null}

      {turn.toolTrace.length ? (
        <section className="agentToolChain">
          <div className="agentCardTitle">
            <Zap size={14} />
            <strong>工具链</strong>
          </div>
          {turn.toolTrace.map((tool) => (
            <article className="agentToolCard" key={tool.id}>
              <div className="agentToolCardHeader">
                <span>
                  <Wrench size={14} />
                  Tool Call: {tool.toolName}
                </span>
                <StatusBadge tone={tool.status === 'succeeded' ? 'ready' : 'review'}>{tool.status}</StatusBadge>
              </div>
              <code>{tool.outputSummary || tool.inputSummary}</code>
            </article>
          ))}
        </section>
      ) : null}

      {turn.evidenceRefs.length ? (
        <section className="agentEvidenceChain">
          <div className="agentCardTitle">
            <Cpu size={14} />
            <strong>证据链</strong>
          </div>
          {turn.evidenceRefs.map((item) => (
            <article className="agentEvidenceCard" key={item.id}>
              <span>{item.label}</span>
              <p>{item.summary}</p>
            </article>
          ))}
        </section>
      ) : null}

      {turn.reviewGate ? <ReviewGateCard gate={turn.reviewGate} /> : null}

      {turn.linkedEntities.length ? (
        <section className="agentLinkedEntities">
          {turn.linkedEntities.map((entity) => (
            entity.href ? (
              <Link href={entity.href} key={entity.id}>{entity.label}: {entity.reason}</Link>
            ) : (
              <span key={entity.id}>{entity.label}: {entity.reason}</span>
            )
          ))}
        </section>
      ) : null}
    </div>
  )
}

function ReviewGateCard({ gate }: { gate: AgentReviewGate }) {
  return (
    <section className="agentReviewActionCard">
      <div className="agentCardTitle">
        <CheckCircle2 size={16} />
        <strong>{gate.question || '人工确认门'}</strong>
      </div>
      <p>{gate.agentRecommendation || '系统已生成需要人工确认的事项。'}</p>
      <Link href="/review-approvals" className="agentReviewActionButton">
        进入 Review 工作台 <ChevronRight size={14} />
      </Link>
    </section>
  )
}

function toTurnMeta(data: ChatResponse): ChatTurnMeta {
  return {
    assistantMessageId: data.assistantMessage.id,
    toolTrace: data.toolTrace,
    evidenceRefs: data.evidenceRefs,
    linkedEntities: data.linkedEntities,
    reviewGate: data.reviewGate,
    runId: data.runId,
    fallbackUsed: data.fallbackUsed,
    thoughts: buildThoughts(data),
  }
}

function buildThoughts(data: ChatResponse): string[] {
  const thoughts = ['锁定当前页面上下文和用户目标。']
  if (data.toolTrace.length) thoughts.push(`选择 ${data.toolTrace.length} 个可审计工具执行，保留 trace 和风险策略。`)
  if (data.evidenceRefs.length) thoughts.push(`汇总 ${data.evidenceRefs.length} 条证据引用，避免前端自行推断。`)
  if (data.reviewGate) thoughts.push('检测到需要人工确认的风险，生成交互卡片。')
  return thoughts
}

function extractComposerText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '')
      return ''
    })
    .join('')
    .trim()
}

function stableSessionKey(context: WorkbenchContext): string {
  const storageKey = 'pickagent.agentCopilot.sessionKey'
  if (typeof window === 'undefined') return `agent-chat-${context.route || 'server'}`
  const existing = readLocalStorage(storageKey)
  if (existing) {
    inMemorySessionKey = existing
    return existing
  }
  if (inMemorySessionKey) return inMemorySessionKey
  const route = context.route.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'console'
  const key = `agent-chat-local-${route}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  inMemorySessionKey = key
  writeLocalStorage(storageKey, key)
  return key
}

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in embedded or privacy-restricted browser contexts.
  }
}

function apiHeaders(sessionKey: string): HeadersInit {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-p0-actor-id': 'frontend_console',
    'x-p0-tenant-id': 'dev_tenant',
    'x-p0-session-id': sessionKey,
    'x-p0-surface': 'agent-copilot',
  }
}
