## Why

本 change 属于 Layer 0，用于把最终设计收敛分工落实到 `workflow / docs / spec freeze` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `workflow / docs / spec freeze` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-design-work-allocation`: 协调层 MUST 将最终设计收敛分工文档拆成可执行 OpenSpec changes，并 SHALL 冻结依赖、边界、并行规则和验收模板。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-design-work-allocation/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: workflow / docs / spec freeze
- Dependencies: 当前最终设计输入文档
- Parallel rule: 串行；冻结完成后才允许启动 Layer 4A。
