## ADDED Requirements

### Requirement: Review list visibility
员工工作台 MUST 提供 Review 列表页，并 SHALL 展示待处理对象、状态、来源类型和可进入详情的入口。

#### Scenario: Browse review list
- **WHEN** 用户进入 Review 页面
- **THEN** 系统展示 Review 列表、状态标记和对象入口

#### Scenario: Filter review items
- **WHEN** 用户使用状态或类型筛选条件
- **THEN** 系统按筛选条件更新列表展示结果

### Requirement: Review detail and decision actions
员工工作台 MUST 提供 Review 详情页，并 SHALL 展示问题、建议、风险、证据摘要以及批准、驳回或修改动作。

#### Scenario: Inspect review detail
- **WHEN** 用户打开某个 Review 项
- **THEN** 系统展示该项的问题说明、建议动作、风险说明和证据摘要

#### Scenario: Decide review item
- **WHEN** 用户对 Review 项执行批准、驳回或修改
- **THEN** 系统记录决策结果并反馈动作状态

### Requirement: Report preview surface
员工工作台 MUST 提供报告预览页，并 SHALL 展示报告章节结构、摘要内容与输出状态。

#### Scenario: View report preview
- **WHEN** 用户进入报告页
- **THEN** 系统展示报告预览内容、章节结构和当前输出状态

#### Scenario: Show export placeholder or action state
- **WHEN** 用户查看报告输出区
- **THEN** 系统展示导出占位或导出动作状态，而不要求首版必须完成全部导出实现

### Requirement: Final review and report integration
员工工作台 MUST 在模块最后阶段接入真实 review 与 report 接口，并 SHALL 保持与 mock 阶段一致的列表、详情和预览路径。

#### Scenario: Replace mock review provider
- **WHEN** 模块进入联调阶段
- **THEN** Review 列表与详情切换到真实 review API 而不改变主要页面结构

#### Scenario: Replace mock report provider
- **WHEN** 模块进入联调阶段
- **THEN** 报告预览区切换到真实 report API 而不改变阅读与输出路径

### Requirement: Review and report source boundary
Review/报告模块 MUST 只消费结构化 Review、Report 和来源对象 DTO，并 SHALL NOT 重新执行活动模拟、重新解释 Agent run 或在页面层改写业务结论。

#### Scenario: Consume upstream review source
- **WHEN** Review 项来自健康诊断、活动模拟或 Agent Gate
- **THEN** 页面展示来源类型、来源对象和 evidence 摘要，并通过 Review API 处理决策

#### Scenario: Preview report without recomputing
- **WHEN** 用户查看报告预览
- **THEN** 页面展示服务端返回的章节、摘要和 evidence summary，而不在前端重新生成报告结论
