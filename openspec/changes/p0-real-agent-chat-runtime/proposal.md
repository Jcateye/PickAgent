## Why

当前 Agent chat 已从 fixture-first 改为 chat-first，但后端仍使用内存 Agent runtime、确定性意图路由和模板回复。用户需要的是类似 ChatGPT 的真实对话应用：消息可恢复、事件可重放、工具调用可追溯，并且没有配置真实模型或持久化时必须明确失败，不能伪装成真实回复。

## What Changes

- 冻结真实 Agent chat runtime 的 P0 需求和验收边界。
- 引入 Prisma-backed conversation repository contract，覆盖 session、mission、run、message、event、tool call 的最小持久化。
- 将 `/api/agent/chat` 切到真实模式入口：配置缺失时 fail closed，不再静默使用 seed、memory 或模板作为生产默认路径。
- 增加 Prisma conversation repository seam，使真实 chat runtime 可以通过已有 AgentSession、AgentMission、AgentRun、AgentMessage、AgentRunEvent 表持久化对话链路。
- 接入 Vercel AI SDK OpenAI provider 作为真实 `AgentModelAdapter`，在模型凭据缺失时继续 fail closed，不生成模板回复。

## Capabilities

### New Capabilities

- `p0-real-agent-chat-runtime`: Agent chat MUST 使用持久化 conversation runtime 保存用户消息、assistant 消息、tool trace 和 run events，并 SHALL 在缺少真实 persistence 或 model adapter 时明确失败。
- `p0-agent-conversation-prisma-repository`: Agent chat repository MUST write conversation records through Prisma delegates when configured, and SHALL fail closed when the Prisma client is absent.
- `p0-vercel-ai-agent-model-adapter`: Agent chat model adapter MUST call Vercel AI SDK provider for assistant replies when configured, and SHALL fail closed without a provider key/model.

## Impact

- Affected systems: Agent chat API, Agent conversation runtime, Agent persistence boundary.
- Dependencies: 用户已授权接入 Vercel AI SDK / provider；本 change 使用 `ai` 和 `@ai-sdk/openai`。
- Risk: L2。涉及 Agent chat 主路径和真实模式配置，不涉及生产外部平台写操作。
