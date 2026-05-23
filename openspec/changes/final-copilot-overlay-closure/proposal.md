## Why

本 change 属于 Layer 4B，用于把最终设计收敛分工落实到 `Agent Copilot 前端` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `Agent Copilot 前端` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-copilot-overlay-closure`: Agent Copilot MUST 从独立 `/agent-chat` 页面收敛为 console layout 常驻 Overlay / Sidecar，并 SHALL 通过 `WorkbenchContext`、SSE 和 Review Gate 与当前工作台对象联动。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-copilot-overlay-closure/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: Agent Copilot 前端
- Dependencies: Layer 0；等待 Agent mission/run/events route 可用。
- Parallel rule: 与其他 Layer 4B 模块并行；不得新增私有业务工具或绕过 AgentToolRegistry。
