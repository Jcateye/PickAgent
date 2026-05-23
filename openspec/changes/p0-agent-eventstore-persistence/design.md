## Context

本子 change 承接 `docs/agent-backend-data-architecture.md` 的 Agent 表设计和 `final-agent-eventstore-foundation` handoff。目标是从 contract foundation 升级为可恢复的生产路径。

## Requirements Boundary

- `AgentRunEvent.sequence` 必须由持久化存储生成或保证单 run 单调递增。
- SSE route 必须先 append 后 stream，并支持 `after=<sequence>` replay。
- `AgentRun` 必须关联 `WorkflowRun`，重要 tool call 必须关联 `WorkflowStep` 或审计 evidence ref。
- `AgentReviewGate` 必须能创建或关联正式 `ReviewItem`。
- Copilot Overlay 默认必须从 EventStore/SSE 恢复，不依赖 fake runtime 默认路径。

## Forbidden Scope

- Pi adapter 不直接访问 Prisma client 或业务 service。
- 不把 runtime-only gate 当作正式人工任务。
- 不保存 cookie、token、JWT、SSO、secret 或模型密钥。
- 不绕过 ToolPolicy 写 tool call 结果。

## Verification

- `openspec validate p0-agent-eventstore-persistence --strict`
- `./scripts/typecheck backend`
- Agent EventStore integration test 覆盖 append、replay、SSE reconnect、restart restore。
- HTTP smoke 覆盖 mission、run、events replay、review gate decision、continuation run。
