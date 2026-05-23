# Decisions

> 本文件用于记录 PickAgent / SKU Ready Agent 当前已经确认、或即将进入 ADR 的关键技术决策。更正式的长期决策应逐步迁移到 `docs/adr/`。

## 状态枚举

- `proposed`
- `accepted`
- `deprecated`
- `superseded`

## 当前已确认决策

### ADR-001 采用双客户端结构：浏览器插件 + 集中式总控制台

- 状态：accepted
- 日期：2026-05-23
- owner：haoqi
- 背景：产品既需要在电商后台页面中就地采集数据，也需要一个独立的集中式工作台承载 Dashboard、Simulation、Review、Report 与 Chat。
- 备选方案：
  - 只做总控制台，不做插件
  - 只做插件，不做独立控制台
  - 同时做插件与总控制台
- 最终决定：
  - `apps/extension/` 承载浏览器插件
  - `apps/frontend/` 承载集中式总控制台
- 决定原因：插件适合作为数据入口，总控制台适合作为决策与协同入口，两者职责清晰且符合 PRD 场景。
- 影响范围：前端工程结构、API 设计、contracts、用户操作路径
- 后续动作：初始化插件与总控制台代码骨架

---

### ADR-002 长期 SKU 主语采用 SkuProfile

- 状态：accepted
- 日期：2026-05-23
- owner：haoqi
- 背景：PRD 要求建立长期 SKU 健康档案，但单靠 `SkuSnapshot` 无法支撑当前状态、历史趋势与跨页面查询。
- 备选方案：
  - 只保留 `SkuSnapshot`
  - 用 `SkuProfile` 作为长期主语
- 最终决定：采用 `SkuProfile` 作为长期 SKU 档案主语。
- 决定原因：能稳定承接 snapshot、diagnosis、simulation、review，并让详情页、列表页、Chat 查询拥有统一主语。
- 影响范围：Prisma schema、QueryService、前端详情页与列表页、API 路由 ID 设计
- 后续动作：在 Prisma schema 中纳入 `SkuProfile`

---

### ADR-003 日常健康结论与活动准入结论必须拆分

- 状态：accepted
- 日期：2026-05-23
- owner：haoqi
- 背景：活动门槛如“库存 >= 500”不能成为所有 SKU 的长期健康标准。
- 备选方案：
  - 统一用一个状态字段表达所有结论
  - 拆分 `healthStatus` 与 `eligibilityStatus`
- 最终决定：
  - `SkuHealthDiagnosis` 表达日常健康结论
  - `ActivitySimulationResult` 表达活动上下文准入结论
- 决定原因：避免活动规则污染长期健康定义，也便于解释和复用。
- 影响范围：数据模型、Dashboard、Simulation 页面、报告与 Review 逻辑
- 后续动作：落实到 schema、DTO 与前端页面文案

---

### ADR-004 Rule DSL 采用有限类型集合

- 状态：accepted
- 日期：2026-05-23
- owner：haoqi
- 背景：活动规则不仅有阈值，还有价格比较、互斥、类目上限、歧义项等，不能只靠 demo if/else。
- 备选方案：
  - 让 LLM 输出任意结构
  - 采用有限的 Canonical Rule DSL
- 最终决定：最小规则类型集合为：
  - `threshold`
  - `field_compare`
  - `boolean_block`
  - `data_required`
  - `quota`
  - `manual_review`
- 决定原因：有限类型更利于规则引擎执行、Zod 校验与前端展示。
- 影响范围：Rule parse、simulation、contracts、Review 生成
- 后续动作：补 ADR 与 contracts schema

---

### ADR-005 CurrentSkuProjection 纳入 P0 正式模型

- 状态：accepted
- 日期：2026-05-23
- owner：haoqi
- 背景：Dashboard、SKU List、Chat summary 都需要稳定 current state；若每个页面自己拼 latest snapshot + diagnosis，会导致前端和 API 变脏。
- 备选方案：
  - 查询时临时拼 latest
  - 建立当前查询投影表 / 视图
- 最终决定：P0 正式纳入 `CurrentSkuProjection`。
- 决定原因：让 current state 成为服务端统一真相，降低前端复杂度，提升查询稳定性。
- 影响范围：QueryService、Dashboard、SKU List、Chat、Report summary
- 后续动作：在 Prisma schema 中纳入 projection 模型或同等实现

---

### ADR-006 Agent Copilot 是双工作台入口，不是私有业务层

- 状态：accepted
- 日期：2026-05-23
- owner：haoqi
- 背景：产品主形态升级为双工作台：人工工作台承接确定性业务操作，Agent Copilot 工作台承接目标驱动规划、原子工具调用、Trace、Context 对照和 Review Gate。系统核心业务仍然是 ingest、diagnosis、simulation 与 review，不能把业务逻辑塞进 chat route。
- 备选方案：
  - Agent Copilot 持有专有业务逻辑
  - Agent Copilot 只通过 Tool Registry 调用已有 application services
- 最终决定：Agent Copilot 不拥有私有业务判断；Pi 负责 agent harness / loop，Vercel AI SDK 负责 LLM 与 tool schema，assistant-ui 负责会话 UI，业务能力只通过 `AgentToolRegistry` 暴露。
- 决定原因：保证页面按钮和 Agent 工具复用同一套业务逻辑，避免双轨实现，并保留 Review Gate 和 Evidence 边界。
- 影响范围：`/api/agent/*`、`/api/chat`、tool design、assistant-ui Copilot、后端服务拆分
- 后续动作：在 `apps/backend/src/agent/tools/` 统一工具定义
