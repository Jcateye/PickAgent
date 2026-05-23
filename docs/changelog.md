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
