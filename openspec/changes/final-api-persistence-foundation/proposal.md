## Why

本 change 属于 Layer 4A，用于把最终设计收敛分工落实到 `后端业务基座` 的可执行 OpenSpec 边界。上一轮已有 change 证明 Layer 3 可演示闭环，但本轮仍创建 `final-*` change，因为最终收敛需要冻结真实 route、持久化、EventStore、Overlay、Pi policy 和最终验收口径，不能把生产化边界混入已完成结论。

## What Changes

- 冻结 `后端业务基座` 的最终收敛需求、验收场景和任务编号。
- 明确依赖层级、并行规则、禁止越界、验证方式和 mock/fake fallback 策略。
- 为后续执行 Agent 提供可直接读取的 proposal、design、tasks 和 spec delta。

## Capabilities

### New Capabilities
- `final-api-persistence-foundation`: 后端 MUST 把 L4 主链路所需 route 绑定到 application service，并 SHALL 通过 repository / transaction 写入或读取稳定数据，而不是继续依赖内存 runtime 作为主路径。

### Modified Capabilities
- 无。本轮通过 `final-*` change 承接旧 change 的经验，不直接修改旧 change 的完成状态。

## Impact

- Affected docs: `openspec/changes/final-api-persistence-foundation/`, `docs/operations/pickagent-final-design-execution-tracker.md`
- Affected systems: 后端业务基座
- Dependencies: Layer 0；复用 backend-business-foundation 的 service 语义，但升级为真实 route/repository/transaction 主路径。
- Parallel rule: 串行，优先合并；下游 4B 必须等待对应 route 可用。
