# Changelog

> 记录对外有感知或对团队协作有影响的重要变更。当前项目尚未进入功能开发阶段，先记录已确认的架构与文档基线。

## 记录格式

### [YYYY-MM-DD] 标题

- 模块：
- 类型：[功能 / 修复 / 契约 / 数据 / 发布 / 架构 / 文档]
- 摘要：
- 影响范围：
- 是否影响 contracts：[是 / 否]
- 是否影响数据结构：[是 / 否]
- 兼容性说明：
- 关联任务 / 决策：

---

### [2026-05-24] 新增 Dashboard/SKU 读模型 API

- 模块：backend / contracts / frontend-api
- 类型：功能
- 摘要：为 Workstream C `dashboard-sku` 新增 SKU 列表与详情抽屉读模型契约、`SkuReadinessQueryService`、read model repository/assembler，并将 `/api/skus`、`/api/skus/{skuProfileId}` 切到显式 P0 auth context + 统一 envelope。列表支持平台、类目、健康状态、活动准入状态、证书状态、分页与排序；详情返回 readiness checklist、EvidenceRef、TraceableRef、相关规则和 Review 引用。
- 影响范围：`apps/contracts/types/dashboardSkuReadModels.ts`、`apps/contracts/openapi/dashboardSkuReadModels.openapi.yaml`、`apps/backend/src/application/foundation/FinalApiPersistenceFoundation.ts`、`apps/frontend/src/app/api/skus/**`
- 是否影响 contracts：是
- 是否影响数据结构：否
- 兼容性说明：不新增 migration，不执行自动改价、自动报名或自动修改商品信息；route handler 只做 parse/auth/service/envelope。
- 关联任务 / 决策：Workstream C: Dashboard/SKU read models API

---

### [2026-05-24] 落地活动管理执行路径 API

- 模块：backend / frontend api / contracts
- 类型：功能
- 摘要：新增 Activity 管理 DTO、ActivityManagement service 聚合能力和 `/api/activities` 资源路由，支持活动创建/更新、规则解析绑定、6 步执行路径、活动 run 审计、活动维度 simulation 运行与详情查询。
- 影响范围：`apps/contracts/types/activityManagement.ts`、`apps/backend/src/application/foundation/FinalApiPersistenceFoundation.ts`、`apps/frontend/src/app/api/activities/**`
- 是否影响 contracts：是
- 是否影响数据结构：否
- 兼容性说明：不新增 migration；P0 使用已有 `activities`、`activity_rule_sets`、`activity_simulation_runs/results` 与 `workflow_runs`。旧的规则集维度 simulation route 已收敛为活动维度 route。
- 关联任务 / 决策：Workstream D Activity management, rules execution path and simulation API

---

### [2026-05-24] 支撑数据源连接器和浏览器插件采集面板

- 模块：backend / frontend-api / contracts
- 类型：功能
- 摘要：新增连接器管理 DTO、ConnectorManagementService、BrowserConnectorService，以及 connectors、connector-runs、browser page detection、scan preview 的最小 API route；连接器同步运行会写入 Workflow 审计引用，scan preview 仅返回预览不写业务真相。
- 影响范围：`apps/contracts/types/connectorBackend.ts`、`apps/backend/src/application/foundation/FinalApiPersistenceFoundation.ts`、`apps/frontend/src/app/api/connectors/**`、`apps/frontend/src/app/api/connector-runs/**`
- 是否影响 contracts：是
- 是否影响数据结构：否
- 兼容性说明：复用现有 `Connector`、`ConnectorRun`、`WorkflowRun` 表，不新增 migration；敏感配置字段在 DTO 中脱敏。
- 关联任务 / 决策：Workstream G / connector-browser-api

---

### [2026-05-24] 支撑规则库与设置 API

- 模块：backend / contracts / frontend api / docs
- 类型：功能
- 摘要：新增 RuleSet list/detail/version/enable/disable 与 workspace/tool-policy/users settings 的最小可验收服务、DTO 和 Next API route。写操作通过 WorkflowRun 审计，工具策略强制保留 L3 runtime tools denylist。
- 影响范围：`apps/contracts/types/businessFoundation.ts`、`apps/backend/src/application/foundation/FinalApiPersistenceFoundation.ts`、`apps/frontend/src/app/api/rule-sets/**`、`apps/frontend/src/app/api/settings/**`
- 是否影响 contracts：是
- 是否影响数据结构：否
- 兼容性说明：复用既有 `activity_rule_sets`、`rule_set_versions`、`workspace_settings` 和 `workflow_runs`，未新增 migration；route handler 仅做 parse/auth/service/envelope。
- 关联任务 / 决策：Workstream H / `rules-settings-api`

---

### [2026-05-24] 补齐 Agent mission/run EventStore API 闭环

- 模块：backend / frontend-api / contracts / docs
- 类型：功能
- 摘要：为 Workstream E agent-run 切片补齐 mission 列表与详情、run 详情、EventStore replay/SSE、pause/cancel、run 内 questions、Review Gate decision 的最小 API 与 service DTO；run 问答限定引用当前 run 的事件、工具调用与 Review Gate 证据，不执行自动改价、报名或商品修改。
- 影响范围：`apps/backend/src/application/foundation/FinalAgentEventStoreFoundation.ts`、`apps/contracts/types/agent-copilot-workbench.ts`、`apps/frontend/src/app/api/agent/**`
- 是否影响 contracts：是
- 是否影响数据结构：否
- 兼容性说明：新增 API 与 DTO 字段，不修改既有数据库 schema；SSE P0 采用短轮询推送现有 EventStore 新增事件，后续可替换为真实 runtime subscriber。
- 关联任务 / 决策：Workstream E: Agent missions/runs persistent EventStore, SSE, pause/cancel/questions/review gates

---

### [2026-05-23] 补充最终设计缺口收敛方案

- 模块：docs / architecture / openspec
- 类型：架构
- 摘要：新增 `docs/final-design-gap-closure.md`，把 Layer 3 当前能力与最终设计目标之间的差距拆成 L4 联调、P0 生产化和 P1 扩展三层，并明确 API route、repository/transaction、Agent SSE、Copilot Overlay、Pi adapter、Tool Registry、Evidence 和真实采集证据的收口口径。
- 影响范围：`docs/final-design-gap-closure.md`、`docs/architecture.md`、`docs/pi-agent-copilot-design.md`、`docs/agent-backend-data-architecture.md`、`openspec/changes/cross-module-integration-and-acceptance/design.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅完善设计和验收口径，不改变当前运行时代码。
- 关联任务 / 决策：Layer 3 到最终设计收敛

---

### [2026-05-23] 更新并行 worktree 路径与状态同步规则

- 模块：docs / workflow / worktree
- 类型：文档
- 摘要：将并行 worktree 根目录调整为 `/Users/haoqi/Documents/GitHub/worktrees/PickAgent`，并在 Codex worktree 启动模板中补充完成后只能同步更新自己被授权 task / requirement 状态、不得修改未授权状态的规则。
- 影响范围：`docs/parallel-worktree-plan.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅更新协作与文档流程，不改变运行时代码。
- 关联任务 / 决策：并行 Codex worktree 协作约束

---

### [2026-05-23] 补充 macmini 本机运维兜底连接

- 模块：docs / deployment / database
- 类型：文档
- 摘要：在运维文档中补充当前基础设施运行在 `macmini` 时的本机直连兜底方案，用于 Cloudflare Access TCP、外部网络或转发链路异常时区分访问链路故障和数据库服务故障。
- 影响范围：`docs/deployment-guidelines.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅补充运维排障说明，不提交任何数据库密钥。
- 关联任务 / 决策：macmini 基础设施本机兜底连接

---

### [2026-05-23] 记录远程数据库运维连接方式

- 模块：docs / deployment / database
- 类型：文档
- 摘要：在运维文档中补充远程 PostgreSQL 通过 Cloudflare Access TCP 转发访问的步骤、`POSTGRES_ENV_FILE` 使用方式、`scripts/migrate --tcp` 命令和共享环境注意事项，并在数据库规范中增加指针。
- 影响范围：`docs/deployment-guidelines.md`、`docs/db-guidelines.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅记录运维操作方式，不提交任何数据库密钥。
- 关联任务 / 决策：远程数据库 migration 运维约定

---

### [2026-05-23] 生成 Agent 工作台数据表与 CRUD 模板

- 模块：backend / prisma / contracts
- 类型：功能
- 摘要：新增 AgentSession、AgentMission、AgentRun、AgentMessage、AgentRunEvent、AgentToolCall、AgentContextSnapshot、AgentContextLink、AgentReviewGate 的 Prisma schema、数据库迁移、基础 CRUD 模板、OpenAPI 合约和 schema-codegen 归档规格。
- 影响范围：`apps/backend/prisma/schema.prisma`、`apps/backend/prisma/migrations/20260523174500_add_agent_copilot_tables/`、`apps/backend/src/**/Agent*.ts`、`apps/contracts/openapi/agent*.yaml`、`docs/generated-schema-specs/backend/Agent*.schema.json`
- 是否影响 contracts：是
- 是否影响数据结构：是
- 兼容性说明：新增表和枚举，不修改既有业务表；Agent 与 Workflow / Review 的跨域引用先以 UUID 弱关联承接，后续服务层再补具体编排逻辑。
- 关联任务 / 决策：Pi Agent Copilot 工作台数据落地

---

### [2026-05-23] 将双工作台原则写入协作入口文档

- 模块：docs / workflow
- 类型：文档
- 摘要：在 `AGENTS.md` 与 `CLAUDE.md` 中加入简短双工作台提醒，并同步旧文档中的旧 Chat 表述为 Agent Copilot、Pi、Vercel AI SDK、assistant-ui 的分工。
- 影响范围：`AGENTS.md`、`CLAUDE.md`、`README.md`、`apps/frontend/README.md`、`docs/PRD.md`、`docs/architecture.md`、`docs/decisions.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅文档口径更新
- 关联任务 / 决策：双工作台产品主形态

---

### [2026-05-23] 确认 Agent 工作台三层运行时分工

- 模块：docs / agent / architecture
- 类型：架构
- 摘要：确认 Pi 负责 Agent harness / loop runtime，Vercel AI SDK 负责 LLM provider、tool schema 与 streaming 适配，assistant-ui 负责会话 UI；业务系统继续负责原子工具、Rule DSL、Evidence 和 Review Gate。
- 影响范围：`docs/PRD.md`、`docs/architecture.md`、`docs/pi-agent-copilot-design.md`、`docs/agent-backend-data-architecture.md`
- 是否影响 contracts：是
- 是否影响数据结构：否
- 兼容性说明：当前为架构边界确认，实际依赖接入和 API contract 仍需在实现阶段提交
- 关联任务 / 决策：Pi Agent Copilot 工作台

---

### [2026-05-23] 补全 Pi Agent 后端数据结构与架构设计

- 模块：docs / agent
- 类型：架构
- 摘要：新增 Agent 后端专项设计，覆盖 AgentSession、AgentMission、AgentRun、AgentMessage、AgentRunEvent、AgentToolCall、AgentContextSnapshot、AgentContextLink、AgentReviewGate 等数据结构，以及 Pi Adapter、Tool Registry、Review Gate、SSE、API 和实施顺序。
- 影响范围：`docs/agent-backend-data-architecture.md`、`docs/pi-agent-copilot-design.md`、`docs/architecture.md`
- 是否影响 contracts：是
- 是否影响数据结构：是
- 兼容性说明：当前为设计文档，实际 Prisma migration 和 API contract 需在实现阶段单独提交
- 关联任务 / 决策：Pi Agent Copilot 后端落地设计

---

### [2026-05-23] 将 Chat 升级为 Agent Copilot 主入口

- 模块：frontend / architecture / docs
- 类型：功能
- 摘要：明确 Agent Copilot 与人工工作台并列，承接目标输入、计划生成、工具编排、长任务状态、执行检查清单和 Review Gate。
- 影响范围：`docs/PRD.md`、`docs/architecture.md`、`design.md`、`README.md`、`apps/frontend/README.md`、`apps/frontend/src/modules/chat/agent-chat-page.tsx`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：当前为前端可演示入口与架构边界调整，不改变已定义 Prisma schema
- 关联任务 / 决策：`docs/adr/2026-05-23-agent-mission-chat-entry.md`

---

### [2026-05-23] 确认 SKU Ready Agent 的 P0 架构基线

- 模块：architecture / docs / apps
- 类型：架构
- 摘要：确认浏览器插件 + 集中式总控制台双客户端结构，确定服务拆分、数据主语、Rule DSL、Review 与 current projection 边界。
- 影响范围：`docs/PRD.md`、`docs/architecture.md`、`claude_prd_report.html`、`apps/*/README.md`
- 是否影响 contracts：是
- 是否影响数据结构：是
- 兼容性说明：当前为开发前架构定稿，不涉及已发布运行时兼容问题
- 关联任务 / 决策：ADR-001 ~ ADR-006

---

### [2026-05-23] 新增 apps/extension 插件工程占位并重写项目说明文档

- 模块：apps / docs / root
- 类型：文档
- 摘要：新增 `apps/extension/` 作为 Plasmo 插件落点，并将通用占位文档改写为 SKU Ready Agent 项目化说明。
- 影响范围：`README.md`、`docs/*.md`、`apps/*/README.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅文档与目录结构层变更，不影响运行时
- 关联任务 / 决策：ADR-001
