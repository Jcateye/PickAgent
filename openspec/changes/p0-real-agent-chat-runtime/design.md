## Context

现有 `/api/agent/chat` 会创建 mission/run，但回复由关键词判断和模板拼接生成，并且 `finalAgentRuntime` 是 in-memory store。它适合演示 chat shell，不满足真实对话、消息恢复和工具审计。

## Boundary

- 本 change 只处理 Agent chat 后端真实模式。
- 不重做前端 UI，不改 SKU/Activity/Review 业务语义。
- 不新增依赖；Vercel AI SDK provider 接入作为下一 requirement，需要用户明确授权依赖变更。
- 不允许真实模式静默回退 seed/memory/template。

## Runtime Shape

```text
POST /api/agent/chat
  -> RealAgentChatRuntime
  -> AgentConversationRepository
  -> AgentModelAdapter
  -> AgentToolExecutor / AgentToolRegistry
  -> AgentMessage + AgentRunEvent + AgentToolCall
```

## Failure Mode

真实模式缺少 repository 或 model adapter 时，API SHALL 返回 `AGENT.REAL_CHAT_NOT_CONFIGURED`，并说明缺少的配置。该错误是可演示产品的正确失败，不允许伪装为 assistant 回复。

## Verification

- `openspec validate p0-real-agent-chat-runtime --strict`
- Typecheck backend/frontend
- Route test: 缺少真实 runtime 时 fail closed
- Runtime test: repository 会保存 user message、run event，并在 model adapter 可用时保存 assistant message
