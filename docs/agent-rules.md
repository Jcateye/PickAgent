# Agent Rules

> 本文件定义在 PickAgent / SKU Ready Agent 仓库内工作的 AI agent 默认边界。目标是让 agent 在受控范围内推进项目，而不是把黑客松范围扩张成通用平台建设。

## 1. 默认工作模式

- 默认围绕 **SKU Ready Agent P0 主闭环** 工作
- 默认按单模块 / 单页面 / 单服务推进
- 默认不扫描整个仓库做无关重构
- 默认不创建新的 `platform_*` 抽象模块
- 默认优先更新现有文档、contracts、schema 与主链路代码

## 2. 默认优先阅读的项目文档

- `docs/PRD.md`
- `claude_prd_report.html`
- `docs/architecture.md`
- `docs/api-guidelines.md`
- `docs/db-guidelines.md`
- `docs/engineering-rules.md`
- 当前任务直接相关的 `apps/*/README.md`

## 3. 当前项目的默认允许读取范围

- 当前任务对应 app 或文档目录
- `apps/contracts/**`
- `docs/**`
- 与当前任务直接相关的 API、schema、workflow、页面文件

## 4. 默认禁止操作

- 擅自扩大 P0 范围
- 擅自把单应用实现升级成复杂平台化架构
- 擅自引入新主框架 / 新基础设施
- 擅自修改数据库主语、Rule DSL、Review 模型的已确认边界
- 擅自让 Chat 拥有独立业务逻辑
- 擅自让插件承担诊断、模拟或审批逻辑

## 5. 当前项目风险分级示例

### `L0`

- 文档更新
- 样式、注释、说明文字
- 报告 HTML 与线框补充

### `L1`

- 单页面 UI 实现
- 单个 service 的非破坏性实现
- 插件扫描 UI、字段映射预览
- 非 breaking 的 DTO / schema 增补

### `L2`

- API contract 调整
- `CurrentSkuProjection` 查询策略变更
- Rule DSL 字段结构调整
- ReviewItem 字段增减
- 前后端联调与 contracts 同步修改

### `L3`

- Prisma schema 主体结构变更
- migration
- 审批流转状态设计调整
- 模块边界调整
- 依赖升级、基础配置变更、部署模型变更

## 6. 当前项目的关键边界

- `SkuProfile` 是长期主语
- `SkuSnapshot` 是采集事实
- `SkuHealthDiagnosis` 是日常健康结论
- `ActivitySimulationResult` 是活动上下文结论
- `CurrentSkuProjection` 是 current state 读模型
- `healthStatus` 与 `eligibilityStatus` 必须拆开
- LLM 只做规则解析，规则引擎做最终准入判断
- Review 是结构化任务，不是留言板

## 7. agent 输出要求

每次执行至少输出：

1. 任务理解
2. 计划修改的文件
3. 实现步骤
4. 风险点
5. 验证步骤
6. 影响范围

若为 `L2` / `L3`，额外输出：

1. 兼容性影响
2. 回滚思路
3. contracts / schema /前端受影响面

## 8. 必须停止并请求人工确认的情况

- 发现需要改变 `SkuProfile` / `Snapshot` / `Diagnosis` / `Simulation` 主语关系
- 发现需要新增或删减 Rule DSL 核心类型
- 发现需要改变 Review 审批模型
- 发现需要调整 apps 目录主结构
- 发现需要执行 migration 或修改已确认 schema 边界
- 发现任务已经从 P0 闭环扩展到平台化建设

## 9. 跨模块任务要求

跨模块任务必须显式声明：

- 主模块
- 协作模块
- 可读取范围
- 可修改范围
- contracts 是否受影响
- Prisma / API / 页面是否同时变更

## 10. 禁止事项

- 不得把“未来可能复用”直接变成“本次先抽平台”
- 不得顺手把插件、总控制台、Chat 各写一套业务逻辑
- 不得绕过 contracts 或 Zod schema 定义跨层结构
- 不得用模糊表述替代已确认的项目边界
