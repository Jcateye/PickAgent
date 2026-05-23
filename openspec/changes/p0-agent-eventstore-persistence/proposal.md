## Why

L4 已证明 Agent EventStore / SSE contract 可用，但 foundation 仍是 in-memory。P0 需要持久化 Agent run、event、tool call、review gate，并把 AgentRun 关联到 WorkflowRun / WorkflowStep 和正式 ReviewItem。

## What Changes

- 冻结 AgentEventStore 持久化、SSE replay 和审计链 requirement。
- 要求 Copilot Overlay 继续消费真实 EventStore/SSE contract。
- 要求 AgentReviewGate 创建或关联正式 ReviewItem。

## Capabilities

### New Capabilities
- `p0-agent-eventstore-persistence`: Agent runtime state MUST persist AgentRun, AgentRunEvent, AgentToolCall, AgentReviewGate, Workflow linkage, and SSE replay data, and SHALL restore Copilot state without fake defaults.

## Impact

- Affected systems: AgentEventStore, AgentRepository, SSE routes, ToolExecutor, Workflow audit, Review Gate, Copilot Overlay contract
- Dependencies: `final-agent-eventstore-foundation`; merge after repository / transaction main path
- Parallel rule: 可在 Prisma interface 稳定后并行开发，晚于 `p0-prisma-repository-transaction` 合并。
