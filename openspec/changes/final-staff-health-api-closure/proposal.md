## Why

本 change 属于 Layer 4B，用于把最终设计收敛分工落实到 `Dashboard / SKU Health` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `Dashboard / SKU Health` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-staff-health-api-closure`: 员工健康工作台 MUST 默认消费真实 summary/list/detail DTO，并 SHALL 只在开发或接口不可用时使用 mock fallback。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-staff-health-api-closure/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: Dashboard / SKU Health
- Dependencies: Layer 0；等待 health summary/list/detail route 可用。
- Parallel rule: 与其他 Layer 4B 模块并行；不得在前端重算 health 或 projection。
