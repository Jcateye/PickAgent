## ADDED Requirements

### Requirement: Target page recognition
插件模块 MUST 在用户打开目标商品列表页时识别当前页面是否可采集，并 SHALL 向用户展示可采集、不可采集或需要人工确认的页面状态。

#### Scenario: Recognized collectible page
- **WHEN** 用户打开符合目标结构的商品列表页并打开插件侧边栏
- **THEN** 插件显示当前页面可采集状态与识别依据摘要

#### Scenario: Unsupported page
- **WHEN** 用户打开不符合目标结构的页面并尝试采集
- **THEN** 插件阻止采集启动并显示不可采集原因

### Requirement: Current page extraction preview
插件模块 MUST 提取当前页记录并生成标准字段预览，且 SHALL 在正式提交前向用户展示字段映射、记录数量和明显缺失项。

#### Scenario: Preview current page rows
- **WHEN** 用户在可采集页面点击扫描当前页
- **THEN** 插件展示当前页记录预览、字段映射结果和采集摘要

#### Scenario: Missing field warning in preview
- **WHEN** 当前页存在无法映射或明显缺失的关键字段
- **THEN** 插件在预览中标记异常项并提示用户确认后续采集风险

### Requirement: Multi-page automated collection
插件模块 MUST 支持按分页或受控循环方式获取全量数据，并 SHALL 在运行过程中展示当前页、累计记录数、运行状态和中断原因。

#### Scenario: Collect across multiple pages
- **WHEN** 用户启动全量采集且目标页面存在多页数据
- **THEN** 插件按顺序采集多页并持续更新运行状态与累计结果

#### Scenario: Interrupted collection
- **WHEN** 自动采集过程中出现翻页失败、页面结构异常或人工暂停
- **THEN** 插件保留当前 run state 并向用户展示中断位置与可继续操作

### Requirement: Final ingest submission
插件模块 MUST 在模块最后阶段支持将采集结果提交到 ingest 接口，且 SHALL 保持与开发期 mock 提交通路相同的数据契约。

#### Scenario: Submit collected payload
- **WHEN** 用户确认采集结果并执行提交
- **THEN** 插件将标准化 payload 发送到提交通路并反馈成功或失败状态

#### Scenario: Swap mock submit with real API
- **WHEN** 模块进入真实联调阶段
- **THEN** 插件在不改变页面交互与 payload 结构的前提下切换到真实 ingest API

### Requirement: Collection-layer boundary
插件模块 MUST 只展示采集事实、字段映射、采集运行状态和采集层风险，并 SHALL NOT 输出健康诊断、活动准入、补货建议、Review 决策或报告结论。

#### Scenario: Show collection risk only
- **WHEN** 当前页存在字段缺失、页面结构异常、翻页失败或 payload 校验失败
- **THEN** 插件展示采集层风险和继续/中断入口，而不推导业务健康或准入结论

#### Scenario: Avoid business conclusion in plugin
- **WHEN** 插件使用 mock 数据或真实采集数据渲染侧边栏
- **THEN** 页面文案和状态只描述采集流程，不宣称 SKU 是否健康、是否可报名或是否需要正式 Review 审批
