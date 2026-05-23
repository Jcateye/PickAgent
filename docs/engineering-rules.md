# Engineering Rules

> 本文件定义 SKU Ready Agent 的工程实现规则。重点不是做通用模板，而是保证插件、总控制台、服务端、contracts 和 workflow 在同一个清晰边界内演进。

## 1. 基本原则

- 先把边界讲清楚，再写实现
- 默认围绕 P0 主闭环开发，不顺手扩张范围
- 客户端负责交互，服务端拥有业务真相
- 不把插件、页面、Chat 各写一套业务逻辑
- 不做为了复用而复用的抽象

## 2. 当前技术栈基线

- 语言与运行时：TypeScript / Node.js
- 总控制台：Next.js + React + assistant-ui
- 插件：Plasmo
- 模型调用：Vercel AI SDK
- 数据库：PostgreSQL
- ORM：Prisma
- 校验：Zod
- 编排：typed workflow
- 包管理器：优先 `pnpm`

除非 ADR 明确批准：

- 不新增 NestJS、Redis、InsForge 等主底座
- 不升级核心框架或做基础设施迁移

## 3. apps/ 目录与职责

### `apps/frontend/`

职责：

- Dashboard
- SKU List / Detail
- Activity Parse / Simulation
- Review Workbench
- Reports
- Chat
- Workflows

建议分层：

- `src/app/`：App Shell、routes、providers、layouts
- `src/modules/`：`dashboard`、`sku`、`activity`、`review`、`report`、`chat`、`workflow`
- `src/shared/`：真正跨模块的 UI、api client、hooks、utils、config

### `apps/extension/`

职责：

- 页面识别
- table 扫描
- 字段映射预览
- 数据质量预估
- ingest 提交

不负责：

- 健康诊断
- 规则解析
- 准入模拟
- Review 决策

建议分层：

- `entrypoints/`：popup、side-panel、content-script
- `lib/`：extractor、adapter、mapping-preview、api client
- `schemas/`：插件内 payload 与 preview schema

### `apps/backend/`

职责：

- API routes / handlers
- application services
- domain evaluators
- prisma / persistence
- workflow / safety / tools

建议分层：

- `src/api/`
- `src/application/`
- `src/domain/`
- `src/infrastructure/`
- `src/workflow/`
- `src/tools/`
- `src/schemas/`
- `src/safety/`
- `prisma/`

### `apps/contracts/`

职责：

- OpenAPI
- errors
- events
- DTO / schema 契约

约束：

- 只放契约，不放业务实现

## 4. 服务拆分规则

当前服务端正式拆分为：

- `IngestService`
- `NormalizationService`
- `HealthAssessmentService`
- `ActivityRuleService`
- `ActivitySimulationService`
- `ReviewService`
- `ReportService`
- `SkuQueryService`
- `ChatToolService`

原则：

- Route handlers 保持薄
- Application services 编排用例与事务边界
- Domain evaluators 负责确定性业务判断
- Repositories 负责数据访问

## 5. 领域边界规则

必须区分：

- `SkuProfile`：长期档案主语
- `SkuSnapshot`：采集事实
- `SkuHealthDiagnosis`：日常健康结论
- `ActivitySimulationResult`：活动上下文准入结论
- `CurrentSkuProjection`：当前查询视图

禁止：

- 让 snapshot 冒充长期档案
- 让 activity eligibility 覆盖长期 health status
- 让页面自己拼 latest snapshot + diagnosis 作为 current state

## 6. Rule DSL 与 LLM 规则

- LLM 只负责把自然语言规则解析为 Canonical Rule DSL
- Rule DSL 必须经 Zod 校验
- 低置信度、解析失败、规则歧义必须进入 Review
- 当前最小规则类型：
  - `threshold`
  - `field_compare`
  - `boolean_block`
  - `data_required`
  - `quota`
  - `manual_review`

## 7. 编码规则

- 单个函数优先表达一个清晰意图
- 复杂逻辑拆出具备领域语义的函数
- HTTP、DB、领域规则不得混写在同一层
- 复杂 DTO 拼装放在 service / assembler，不放在 React 页面或 route handler
- Chat tool 与页面 action 必须复用同一 application service
- `healthScore` 只是辅助展示，不能推翻 hard rules

## 8. 前端实现规则

### 总控制台

- 列表页优先读取 `CurrentSkuProjection`
- 详情页优先读取聚合 DTO，不在前端自行拼装
- Dashboard 不重新计算健康状态，只展示 summary/projection
- Chat 页面只展示 tool trace 与结果，不附带额外私有业务逻辑

### 插件

- popup 只做轻入口
- 主工作流在 side panel
- 插件本地状态只保存本次采集会话，不保存业务真相
- 采集异常属于 ingest 风险，不属于业务健康风险

## 9. 共享目录与依赖规则

- 前端、插件、后端都只能依赖 `apps/contracts/` 中的公开契约
- 不得跨 app 直接依赖内部实现
- 不得把业务实现放进 `docs/` 或 `contracts/`
- 新增三方依赖必须说明用途与维护成本

## 10. 脚本与运行入口

项目统一通过根目录 `scripts/` 暴露运行入口：

- `scripts/bootstrap`
- `scripts/dev`
- `scripts/test`
- `scripts/lint`
- `scripts/typecheck`
- `scripts/build`
- `scripts/migrate`
- `scripts/deploy`

要求：

- CI / 本地 / agent 自动化优先调用这些门面入口
- 不直接把底层工具命令写死到协作文档里

## 11. 质量门禁

至少满足：

- lint
- typecheck
- 核心改动的测试或明确未补原因
- L2 / L3 改动必须补验证步骤

P0 特别关注：

- ingest payload 校验
- rule parse output 校验
- simulation 核心规则正确性
- review decision 流转

## 12. 禁止事项

- 不得顺手重构无关模块
- 不得让插件承担核心业务判断
- 不得让 Chat 成为私有业务后门
- 不得把 Evidence 只存成自然语言字符串
- 不得在没有 ADR 的情况下扩大为 `platform_*` 抽象
