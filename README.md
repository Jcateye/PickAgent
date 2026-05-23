# PickAgent

SKU Ready Agent 项目仓库。

## 项目定位

PickAgent 当前承载的核心产品是 **SKU Ready Agent**：一个面向电商商品运营场景的多平台商品健康监控与活动准入智能体。

它的目标不是替代 Excel 做一次性筛选，而是建立一套持续运行的执行辅助系统：

- 平时通过浏览器插件与其他连接器采集 SKU 数据
- 在服务端建立长期 SKU 健康档案
- 在活动规则发布后解析规则并执行准入模拟
- 对不确定、高风险、跨部门确认事项生成 Review 项
- 通过总控制台、报告与 Chat 控制台提供查询与协同入口

## 当前确认的系统形态

### 客户端

- `apps/extension/`：浏览器插件（Plasmo）
- `apps/frontend/`：集中式总控制台（Next.js Dashboard + assistant-ui Chat）

### 服务端与共享层

- `apps/backend/`：后端实现与后续模块根目录
- `apps/contracts/`：OpenAPI、错误码、事件、共享 schema 与 DTO 契约

### 文档与决策

- `docs/PRD.md`：需求 PRD
- `docs/architecture.md`：技术架构与模块边界
- `docs/api-guidelines.md`：API 资源设计与响应约束
- `docs/db-guidelines.md`：数据库与 Prisma 设计原则
- `docs/engineering-rules.md`：工程分层与实现规则
- `claude_prd_report.html`：当前最完整的架构评审与前端草图汇总报告

## 当前技术栈

- 语言：TypeScript
- 总控制台：Next.js
- Chat UI：assistant-ui
- 浏览器插件：Plasmo
- 模型调用：Vercel AI SDK
- 数据库：PostgreSQL
- ORM：Prisma
- 校验：Zod
- 编排：typed workflow

## 当前目录约定

```txt
PickAgent/
  apps/
    frontend/      # 总控制台
    extension/     # 浏览器插件
    backend/       # 后端实现与后续模块
    contracts/     # OpenAPI / errors / events / shared schemas
  docs/
    PRD.md
    architecture.md
    api-guidelines.md
    db-guidelines.md
    engineering-rules.md
    adr/
  scripts/
```

## 当前已确认的 P0 设计边界

- `SkuProfile` 是长期 SKU 档案主语
- `SkuSnapshot` 是采集事实，不冒充长期档案
- `SkuHealthDiagnosis` 表达日常健康结论
- `ActivitySimulationResult` 表达活动上下文下的准入结论
- `healthStatus` 与 `eligibilityStatus` 必须拆开
- LLM 只做规则解析，规则引擎做最终准入判断
- 所有不确定项通过 Review Gate 进入人工确认
- Chat 只是自然语言控制台，不承担核心业务判断

## 当前推荐主链路

1. 插件扫描模拟商品后台页面
2. 提交 `/api/ingest`
3. 服务端完成标准化、建档、健康诊断
4. 用户录入活动规则并解析为 Canonical Rule DSL
5. 服务端执行活动准入模拟
6. 生成 Review 清单与报告
7. 总控制台展示 Dashboard、SKU 详情、Simulation、Review、Chat

## 当前仓库状态

- PRD、架构文档、工程约束、前端线框与数据结构草图已确认
- `apps/` 目录已按最终形态预留
- 业务实现代码尚未正式启动

## 下一步建议

1. 按已确认设计初始化 `apps/frontend/`、`apps/extension/`、`apps/backend/` 代码骨架
2. 先落 P0 的 Prisma schema 与 API contract
3. 优先实现 ingest → diagnosis → simulation → review 的主闭环
4. 再进入总控制台和插件的前端 UI 细化
