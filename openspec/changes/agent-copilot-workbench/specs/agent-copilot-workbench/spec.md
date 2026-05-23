## ADDED Requirements

### Requirement: Mission-centered agent surface
Agent 工作台 MUST 允许用户发起 Mission，并 SHALL 展示围绕 Mission 的消息流、当前状态和下一步入口，而不是仅提供自由聊天输入框。

#### Scenario: Start a mission
- **WHEN** 用户在 Agent 工作台输入目标并发起一次 Mission
- **THEN** 系统展示该 Mission 的消息流、状态和后续执行区域

#### Scenario: Continue a mission
- **WHEN** 用户在已有 Mission 上继续输入消息
- **THEN** 系统在同一 Mission 语义下追加新的交互与状态变化

### Requirement: Plan, trace, and context visibility
Agent 工作台 MUST 展示 Plan、Tool Trace、Linked Context 和 Evidence 面板，并 SHALL 让用户能够在消息之外查看执行路径和对象关联。

#### Scenario: View plan and trace
- **WHEN** Agent run 进入规划或执行阶段
- **THEN** 系统展示当前 Plan、工具轨迹和对应状态变化

#### Scenario: View linked entities and evidence
- **WHEN** Agent 回复引用业务对象或证据
- **THEN** 系统展示关联对象与证据入口，而不是只输出纯文本说明

### Requirement: Review gate pause and resume
Agent 工作台 MUST 在遇到 Review Gate 时暂停 run，并 SHALL 允许用户查看问题、建议和风险后继续、拒绝或修改。

#### Scenario: Pause on review gate
- **WHEN** Agent run 产生需要人工确认的 Gate
- **THEN** 系统暂停当前 run 并展示 Gate 的问题、建议和风险说明

#### Scenario: Resume after decision
- **WHEN** 用户对 Gate 作出决策
- **THEN** 系统恢复或继续该 Mission 的后续执行流程

### Requirement: Final runtime and tool integration
Agent 工作台 MUST 在模块最后阶段接入真实 Hermes/Pi runtime 与业务工具，并 SHALL 保持与 mock 阶段一致的 Mission、Run、Event 与 Gate contract。

#### Scenario: Replace mock event provider
- **WHEN** 模块进入真实联调阶段
- **THEN** 前端从 mock event stream 切换到真实 runtime 事件流而不改变主要工作台结构

#### Scenario: Replace mock tool results
- **WHEN** 模块进入真实联调阶段
- **THEN** Tool Trace 与消息流切换到真实业务工具结果而不改变用户的查看路径

### Requirement: Tool registry boundary
Agent 工作台 MUST 通过 `AgentToolRegistry` 调用业务能力，并 SHALL NOT 让 runtime、Hermes/Pi adapter 或前端页面直接访问数据库、repository 或员工工作台私有业务逻辑。

#### Scenario: Execute registered tool
- **WHEN** Agent run 需要查询 SKU、解析规则、执行模拟、创建 Review 或生成报告预览
- **THEN** 系统通过已注册工具调用后端 application service，并记录 tool trace、linked entity 和 evidence 摘要

#### Scenario: Keep fake and real runtime aligned
- **WHEN** 模块从 fake run provider 切换到真实 Pi/Hermes runtime adapter
- **THEN** 前端继续消费同一 Mission、Run、Event、Gate 和 linked entity contract
