## ADDED Requirements

### Requirement: Real Agent chat runtime

Agent chat MUST 使用持久化 conversation runtime 保存用户消息、assistant 消息、tool trace 和 run events，并 SHALL 在缺少真实 persistence 或 model adapter 时明确失败，不得静默回退到 seed、memory 或模板回复。

#### Scenario: Fail closed without real runtime

- **WHEN** `/api/agent/chat` 收到用户消息但真实 persistence 或 model adapter 未配置
- **THEN** API 返回 `AGENT.REAL_CHAT_NOT_CONFIGURED`，且不生成伪 assistant 回复。

#### Scenario: Persist user and assistant messages

- **WHEN** model adapter 返回 assistant 回复
- **THEN** repository 保存 user message、assistant message、AgentRun 和 AgentRunEvent。

#### Scenario: Preserve tool trace boundary

- **WHEN** runtime 调用业务工具
- **THEN** tool call SHALL 经过 AgentToolExecutor / AgentToolRegistry，并记录 tool event 和 evidence refs。

#### Scenario: No fixture seed in real chat

- **WHEN** chat runtime 处于真实模式
- **THEN** runtime SHALL NOT 自动注入 fixture SKU、fixture rules 或模板演示回复。
