## Why

本 change 属于 Layer 4B，用于把最终设计收敛分工落实到 `Reviews / Reports` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `Reviews / Reports` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-review-reporting-closure`: Review / Reports MUST 共用后端持久化状态和 evidence summary，并 SHALL 修复 Reports SSR / hydration 不稳定问题。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-review-reporting-closure/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: Reviews / Reports
- Dependencies: Layer 0；等待 review/report route 可用，可先用 activity fixture。
- Parallel rule: 与其他 Layer 4B 模块并行；不得在 Reports 前端重算业务结论。
