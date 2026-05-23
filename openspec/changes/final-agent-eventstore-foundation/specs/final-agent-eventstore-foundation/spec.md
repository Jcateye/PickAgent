## ADDED Requirements

### Requirement: Agent EventStore and ToolExecutor foundation
Agent 后端 MUST 通过 `AgentEventStore`、`AgentToolExecutor` 和 policy 层记录 run、event、tool call、review gate 和 evidence，并 SHALL 禁止 Pi adapter 直接访问业务 service 或 Prisma client。

#### Scenario: Append before streaming
- **WHEN** Agent run 产生事件
- **THEN** 后端先写 `AgentRunEvent.sequence`，再通过 SSE 推给前端。

#### Scenario: Replay missing events
- **WHEN** SSE 断线重连
- **THEN** `GET /api/agent/runs/:runId/events?after=<sequence>` 返回缺失事件。

#### Scenario: Execute through policy
- **WHEN** Agent 调用工具
- **THEN** 工具执行经过 `ToolPolicy`、`ReviewGatePolicy`、application service，并写入 `AgentToolCall`。
