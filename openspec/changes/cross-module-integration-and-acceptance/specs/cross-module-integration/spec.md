## ADDED Requirements

### Requirement: Integration readiness gates
系统 MUST 为后端业务基座和每个前置业务模块定义“已完成且不阻塞”的联调准入条件，并 SHALL 只允许满足条件的模块进入统一联调。

#### Scenario: Module ready for integration
- **WHEN** 某个前置模块完成自身开发并满足约定的就绪条件
- **THEN** 系统将该模块标记为可进入统一联调

#### Scenario: Module not ready for integration
- **WHEN** 某个前置模块尚未满足就绪条件
- **THEN** 系统不将其纳入统一联调阻塞范围

### Requirement: Fixed cross-module integration order
系统 MUST 按固定主链路顺序执行跨模块联调，并 SHALL 至少覆盖后端业务基座、插件到工作台、活动模拟到 Review、工作台到 Agent 和 Agent 到真实工具五条主链路。

#### Scenario: Execute integration chain in order
- **WHEN** 统一联调开始
- **THEN** 系统按预定义顺序逐条验证主链路，而不是随机并发打通

#### Scenario: Stop and record blocker on a chain
- **WHEN** 某条联调链路出现阻塞
- **THEN** 系统记录阻塞位置、影响范围和回流模块

### Requirement: Blocker tracking and regression verification
系统 MUST 记录跨模块阻塞问题，并 SHALL 在对应模块修复后重新验证受影响链路。

#### Scenario: Record blocker ownership
- **WHEN** 联调中发现问题
- **THEN** 系统记录问题所属模块、链路位置和待回归状态

#### Scenario: Verify after fix
- **WHEN** 对应模块完成修复
- **THEN** 系统重新验证受影响链路并更新问题状态

### Requirement: Final acceptance handoff
系统 MUST 在所有主链路验证通过后完成最终验收，并 SHALL 生成可用于演示或交付的验收结论。

#### Scenario: Complete final acceptance
- **WHEN** 所有定义的主链路均通过验证
- **THEN** 系统输出最终验收结论并标记跨模块联调完成

#### Scenario: Keep acceptance open on unresolved blocker
- **WHEN** 仍存在未解决的关键阻塞问题
- **THEN** 系统保持统一验收未完成状态并禁止宣告整体闭环完成

### Requirement: Readiness evidence template
系统 MUST 要求每个进入统一联调的模块提供 readiness evidence，并 SHALL 用同一模板记录 mock 闭环、contract、fixture、验证结果和真实接入依赖。

#### Scenario: Provide module readiness evidence
- **WHEN** 某个模块申请进入统一联调
- **THEN** 系统检查该模块是否提供 mock 闭环、冻结 contract、fixture、验证结果和真实接入依赖状态

#### Scenario: Reject incomplete readiness evidence
- **WHEN** 某个模块缺少 readiness evidence 或无法说明阻塞项
- **THEN** 系统不允许该模块进入统一联调，并记录缺失项
