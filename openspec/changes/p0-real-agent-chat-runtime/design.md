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

## Prisma Repository Seam

`PrismaAgentConversationRepository` 使用结构化 Prisma client interface，而不直接依赖生成后的 `@prisma/client` 类型。这样可以在当前仓库没有稳定 generated client 时保持 typecheck 可运行，同时让 route 在 runtime 层通过 `@prisma/client` 注入真实 delegate。

Repository SHALL cover:

- `AgentSession` upsert by `sessionKey`
- `AgentMission` create
- `AgentRun` create/update status
- `AgentMessage` append with next `orderIndex`
- `AgentRunEvent` append with next `sequence`

Repository SHALL NOT create fixture SKU、fixture rules 或模板 assistant reply。缺失 delegate 或 client 加载失败时由 route 返回 `AGENT.REAL_CHAT_NOT_CONFIGURED`。

## Vercel AI SDK Model Adapter

`VercelAiSdkAgentModelAdapter` 使用 Vercel AI SDK Core 的 text generation API 和 OpenAI provider。Adapter SHALL:

- 从明确配置的 provider model 生成 assistant reply
- 将 WorkbenchContext 和最近用户消息作为 messages/context 传入
- 返回 model usage/metadata 供 `AgentMessage.contentJson` 与 `AgentRunEvent.payloadJson` 记录
- 不内置关键词模板、fixture 回复或业务结论重算

Adapter SHALL NOT 直接执行业务工具。后续工具调用必须经 `AgentToolExecutor` / `AgentToolRegistry`，并由 runtime 记录 tool event/evidence refs。

## Failure Mode

真实模式缺少 repository 或 model adapter 时，API SHALL 返回 `AGENT.REAL_CHAT_NOT_CONFIGURED`，并说明缺少的配置。该错误是可演示产品的正确失败，不允许伪装为 assistant 回复。

## Verification

- `openspec validate p0-real-agent-chat-runtime --strict`
- Typecheck backend/frontend
- Route test: 缺少真实 runtime 时 fail closed
- Runtime test: repository 会保存 user message、run event，并在 model adapter 可用时保存 assistant message
- Repository test: Prisma delegates receive AgentSession、AgentMission、AgentRun、AgentMessage、AgentRunEvent writes in order
- Model adapter test: AI SDK call returns assistant content and records provider/model metadata
- Route test: missing model provider returns `AGENT.REAL_CHAT_NOT_CONFIGURED`
