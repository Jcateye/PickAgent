## Why

本 change 属于 Layer 4B，用于把最终设计收敛分工落实到 `Activities` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `Activities` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-activity-simulation-closure`: 活动工作台 MUST 通过真实 parse/simulation API 生成活动上下文准入结论，并 SHALL 将 `ActivitySimulationResult` 与长期健康状态分开。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-activity-simulation-closure/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: Activities
- Dependencies: Layer 0；等待 activity parse/simulation route 可用。
- Parallel rule: 与其他 Layer 4B 模块并行；不得修改长期 health 状态语义。
