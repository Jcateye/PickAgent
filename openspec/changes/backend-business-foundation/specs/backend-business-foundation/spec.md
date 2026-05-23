## ADDED Requirements

### Requirement: Ingest and health projection foundation
后端 MUST 提供最小 ingest / normalization / health projection 链路，并 SHALL 在接收标准采集 payload 后生成 SKU 档案、采集快照、健康诊断和当前读模型。

#### Scenario: Ingest collected rows
- **WHEN** 插件或测试 fixture 提交标准化采集 payload
- **THEN** 后端创建或更新 `SkuProfile`、写入 `SkuSnapshot`，并保留 raw 与 normalized 数据

#### Scenario: Update current projection
- **WHEN** ingest 链路完成一次有效采集
- **THEN** 后端更新 `CurrentSkuProjection`，使员工工作台可以读取 summary、SKU 列表和 SKU 详情

### Requirement: Rule DSL and simulation foundation
后端 MUST 提供 Canonical Rule DSL 校验与活动模拟能力，并 SHALL 将活动上下文准入结论与长期健康诊断分开。

#### Scenario: Validate parsed rules
- **WHEN** 用户提交活动规则文本或 mock parser 输出结构化规则
- **THEN** 后端使用 Zod 校验 Canonical Rule DSL，并记录 parse status、confidence 和错误信息

#### Scenario: Run activity simulation
- **WHEN** 用户基于有效规则集执行活动模拟
- **THEN** 后端按 DIRECT_READY、REPAIRABLE_READY、MANUAL_REVIEW、BLOCKED 输出结果、失败规则、evidence 和修复建议

#### Scenario: Run what-if simulation
- **WHEN** 用户提交补货、价格或资料补全等 what-if 输入
- **THEN** 后端返回原始状态与变更后状态的对比，而不修改真实 SKU 档案

### Requirement: Review and report foundation
后端 MUST 统一生成和处理 ReviewItem，并 SHALL 提供报告预览 DTO 与 evidence summary。

#### Scenario: Generate review items
- **WHEN** 模拟、健康诊断或 Agent 工具产生人工确认需求
- **THEN** 后端创建结构化 `ReviewItem`，包含问题、建议、风险、来源对象和 evidence

#### Scenario: Decide review item
- **WHEN** 用户批准、驳回或修改 Review 项
- **THEN** 后端记录决策、决策人、决策时间和备注，并返回更新后的状态

#### Scenario: Generate report preview
- **WHEN** 用户请求健康或活动报告预览
- **THEN** 后端返回章节结构、摘要内容、输出状态和 evidence summary

### Requirement: Agent tool foundation
后端 MUST 通过 `AgentToolRegistry` 暴露业务工具，并 SHALL 让 Agent 工具复用 application service，而不是直接访问数据库或私有业务逻辑。

#### Scenario: Register minimal tools
- **WHEN** Agent 工作台请求可用工具列表或启动 fake run
- **THEN** 后端提供最小工具集合，覆盖 SKU 查询、规则解析、模拟、Review 创建和报告预览

#### Scenario: Execute tool through service boundary
- **WHEN** Agent 调用已注册业务工具
- **THEN** 工具通过 application service 执行，并返回 trace、linked entity 和 evidence 摘要

### Requirement: Downstream readiness signal
后端基座 MUST 为下游业务模块提供可验证的完成信号，并 SHALL 明确哪些真实接入项已经不阻塞。

#### Scenario: Mark downstream capability unblocked
- **WHEN** 某条后端能力通过 contract 校验、单元测试和脚本验证
- **THEN** 后端基座记录对应下游模块的真实接入项为“已完成，不阻塞”

#### Scenario: Keep blocked integration explicit
- **WHEN** 某条能力未完成或验证失败
- **THEN** 后端基座记录阻塞原因、影响模块和下一步修复项，而不允许上游模块宣称真实联调完成
