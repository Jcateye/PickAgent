## Why

本 change 属于 Layer 4A，用于把最终设计收敛分工落实到 `Agent 后端基座` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `Agent 后端基座` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-agent-eventstore-foundation`: Agent 后端 MUST 通过 `AgentEventStore`、`AgentToolExecutor` 和 policy 层记录 run、event、tool call、review gate 和 evidence，并 SHALL 禁止 Pi adapter 直接访问业务 service 或 Prisma client。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-agent-eventstore-foundation/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: Agent 后端基座
- Dependencies: Layer 0；依赖 final-api-persistence-foundation 的 model / repository 决策。
- Parallel rule: 可和后端基座后半段协作，但 merge 顺序在 API/persistence 基座之后。
