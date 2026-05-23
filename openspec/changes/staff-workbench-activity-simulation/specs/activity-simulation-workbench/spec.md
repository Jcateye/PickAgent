## ADDED Requirements

### Requirement: Activity rule authoring surface
员工工作台 MUST 允许用户录入活动规则文本，并 SHALL 展示规则原文与结构化结果的并列视图。

#### Scenario: Enter and parse rule text
- **WHEN** 用户输入或粘贴活动规则文本
- **THEN** 系统展示规则原文区域以及对应的结构化结果区域

#### Scenario: Preserve raw text context
- **WHEN** 用户查看结构化规则
- **THEN** 系统仍可让用户回看原始规则文本与对应 evidence

### Requirement: Simulation result visibility
员工工作台 MUST 展示准入模拟结果，并 SHALL 按状态分组展示可直接报名、可修复后报名、需人工确认和阻断结果。

#### Scenario: View grouped simulation results
- **WHEN** 用户完成一次模拟
- **THEN** 系统按状态分组展示模拟结果摘要与各组对象入口

#### Scenario: Inspect failed reasons and repair plans
- **WHEN** 用户查看某个模拟结果对象
- **THEN** 系统展示失败规则、证据摘要和修复建议

### Requirement: What-if simulation flow
员工工作台 MUST 提供 what-if 模拟入口，并 SHALL 允许用户基于指定变更条件查看新的模拟结论。

#### Scenario: Run what-if simulation
- **WHEN** 用户输入补货或其他变更条件并执行 what-if
- **THEN** 系统展示变更后的模拟结果与差异摘要

#### Scenario: Compare original and what-if states
- **WHEN** 用户查看 what-if 结果
- **THEN** 系统展示原始状态与变更后状态的对比信息

### Requirement: Final parse and simulation integration
员工工作台 MUST 在模块最后阶段接入真实 rule parse 与 simulation 接口，并 SHALL 保持与 mock 阶段一致的录入、展示和查看路径。

#### Scenario: Replace mock parse adapter
- **WHEN** 模块进入联调阶段
- **THEN** 规则结构化区域切换到真实 parse 接口而不改变页面交互骨架

#### Scenario: Replace mock simulation adapter
- **WHEN** 模块进入联调阶段
- **THEN** 模拟结果区域切换到真实 simulation 接口而不改变结果查看路径

### Requirement: Activity context boundary
员工工作台活动模拟模块 MUST 只展示活动上下文准入结论，并 SHALL NOT 覆盖长期健康诊断或处理正式 Review 决策。

#### Scenario: Keep health and eligibility separate
- **WHEN** 用户查看一次活动模拟结果
- **THEN** 页面展示活动准入状态、失败规则和修复建议，但不修改或重算 SKU 长期健康状态

#### Scenario: Hand off manual review
- **WHEN** 模拟结果产生 MANUAL_REVIEW 结论
- **THEN** 页面展示人工确认提示与来源对象，并把正式审批交给 Review 工作台
