'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AgentRunEvent } from './types'

interface EventReplayEnvelope {
  code: string
  data: {
    items: AgentRunEvent[]
    after: number
  }
}

export function useAgentRunEvents(runId: string | null) {
  const [events, setEvents] = useState<AgentRunEvent[]>([])
  const [mode, setMode] = useState<'idle' | 'replay' | 'sse' | 'polling' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const lastSequenceRef = useRef(0)

  const mergeEvents = useCallback((incoming: AgentRunEvent[]) => {
    if (incoming.length === 0) return
    setEvents((current) => {
      const byId = new Map(current.map((event) => [event.id, event]))
      for (const event of incoming) byId.set(event.id, event)
      const merged = Array.from(byId.values()).sort((left, right) => left.sequence - right.sequence)
      lastSequenceRef.current = Math.max(lastSequenceRef.current, ...merged.map((event) => event.sequence))
      return merged
    })
  }, [])

  const replay = useCallback(async () => {
    if (!runId) return
    const after = lastSequenceRef.current
    setMode('replay')
    const response = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/events?after=${after}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`Event replay failed: ${response.status}`)
    const envelope = (await response.json()) as EventReplayEnvelope
    mergeEvents(envelope.data.items)
    setError(null)
  }, [mergeEvents, runId])

  useEffect(() => {
    if (!runId) {
      setMode('idle')
      setEvents([])
      lastSequenceRef.current = 0
      return
    }

    let disposed = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let eventSource: EventSource | null = null

    async function start() {
      try {
        await replay()
      } catch (replayError) {
        if (disposed) return
        setMode('error')
        setError(replayError instanceof Error ? replayError.message : 'Event replay failed')
      }

      if (disposed) return

      const activeRunId = runId
      if (!activeRunId) return
      eventSource = new EventSource(`/api/agent/runs/${encodeURIComponent(activeRunId)}/events?after=${lastSequenceRef.current}&stream=1`)
      eventSource.onopen = () => {
        if (!disposed) setMode('sse')
      }
      const handleMessage = (message: MessageEvent<string>) => {
        try {
          mergeEvents([JSON.parse(message.data) as AgentRunEvent])
          setError(null)
        } catch {
          setError('Received invalid SSE event payload')
        }
      }
      eventSource.onmessage = handleMessage
      for (const eventType of ['run.started', 'run.status_changed', 'tool.call_recorded', 'review_gate.decided', 'run.continuation_started', 'run.workflow_step_linked']) {
        eventSource.addEventListener(eventType, handleMessage)
      }
      eventSource.onerror = () => {
        if (disposed) return
        eventSource?.close()
        setMode('polling')
        pollTimer = setInterval(() => {
          void replay().catch((pollError) => {
            setMode('error')
            setError(pollError instanceof Error ? pollError.message : 'Event polling replay failed')
          })
        }, 4000)
      }
    }

    void start()

    return () => {
      disposed = true
      eventSource?.close()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [mergeEvents, replay, runId])

  return { events, lastSequence: lastSequenceRef.current, mode, error, replay }
}
