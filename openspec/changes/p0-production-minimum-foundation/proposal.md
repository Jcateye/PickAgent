## Why

L4 已 accepted，但验收报告明确留下生产化 P1 risk：默认 in-memory runtime、开发态 smoke、Agent EventStore 非持久化、Pi adapter 仍需生产边界收紧。P0 生产化最小层用于把这些风险收敛为可并行执行的最小生产基座，而不是扩张业务功能。

## What Changes

- 冻结 P0 生产化最小层总口径和验收边界。
- 将执行拆为 4 个可并行子 change：Prisma repository / transaction、AgentEventStore persistence、Auth boundary / runtime config、production acceptance smoke。
- 明确 merge 顺序、P0 blocker / P1 risk 判定、验证命令和 Review Gate 交接口径。
- 不修改业务代码；本 change 只冻结 specs、设计和分工。

## Capabilities

### New Capabilities
- `p0-production-minimum-foundation`: P0 生产化最小层 MUST 将 L4 P1 risk 收敛为可启动生产路径，并 SHALL 以真实持久化、鉴权边界、Agent 审计链和 build/start smoke 作为开工门槛。

### Modified Capabilities
- 无。本 change 不改写已 accepted 的 L4 结论，只定义 L4 之后的 P0 收敛层。

## Impact

- Affected docs: `openspec/changes/p0-production-minimum-foundation/`, `docs/operations/pickagent-p0-production-minimum-work-allocation.md`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: API persistence, Agent EventStore, auth/runtime boundary, production acceptance smoke
- Dependencies: L4 accepted；`final-api-persistence-foundation`、`final-agent-eventstore-foundation`、`final-pi-tool-policy-poc` handoff
- Parallel rule: 子 change 可分工并行；merge 必须按本 change 的 dependency order 执行。
