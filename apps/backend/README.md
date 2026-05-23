# PickAgent Backend

`apps/backend/` 承载 SKU Ready Agent 的服务端实现、数据库模型、规则执行、workflow 与 AI tools。

## 当前目标

围绕 P0 主闭环交付：

1. ingest
2. health diagnosis
3. activity rule parse
4. simulation
5. review
6. report
7. chat tools

## 当前正式服务拆分

- `IngestService`
- `NormalizationService`
- `HealthAssessmentService`
- `ActivityRuleService`
- `ActivitySimulationService`
- `ReviewService`
- `ReportService`
- `SkuQueryService`
- `ChatToolService`

## 建议目录

```txt
apps/backend/
  src/
    api/
    application/
    domain/
    infrastructure/
    workflow/
    tools/
    schemas/
    safety/
  prisma/
```

## 领域边界

- `SkuProfile`：长期 SKU 档案主语
- `SkuSnapshot`：采集事实
- `SkuHealthDiagnosis`：日常健康结论
- `CurrentSkuProjection`：当前查询视图
- `ActivityRuleSet`：规则原文与 Rule DSL
- `ActivitySimulationRun / Result`：活动准入上下文结论
- `ReviewItem`：结构化审批任务
- `WorkflowRun / Step`：最小执行审计

## 当前约束

- LLM 只做规则解析与表达
- 最终业务准入判断由规则引擎执行
- 所有外部输入与 LLM 输出都要经过 Zod 校验
- Chat tools 不直接访问数据库，复用 application services
- 不在没有 ADR 的情况下过早生成 `business_*` / `platform_*` 抽象模块

## 当前状态

- 目录已预留
- Prisma schema 与首个 PostgreSQL 初始化 migration 已建立
- 基于 P0 数据表生成了 TypeScript 分层 CRUD 初始骨架
- 当前以单应用服务端实现优先，后续如确有收益再拆具体模块

## 已生成后端骨架

`schema-codegen` 已按现有 P0 数据结构生成：

- `src/infrastructure/persistence/`：数据库存储 Record 类型
- `src/domain/entities/`：领域实体类型
- `src/api/dto/`：create / update / query / response DTO
- `src/infrastructure/mappers/`：Record / Entity / Response DTO 映射器
- `src/infrastructure/repository/`：仓储接口
- `src/application/services/`：基础 CRUD service
- `src/api/controllers/`：控制器骨架
- `src/api/routes/`：路由定义骨架
- `tests/unit/`：单测占位

这些文件是可继续接 Prisma repository、Zod 校验和实际 HTTP 框架绑定的初始代码，不包含 NestJS 或 Redis 运行时依赖。

## 数据库初始化

远程数据库通过 Cloudflare Access TCP 访问时，先在单独终端启动转发：

```bash
cloudflared access tcp \
  --hostname postgres.justpyq.com \
  --url 127.0.0.1:15432
```

然后执行：

```bash
POSTGRES_ENV_FILE=/Users/haoqi/clawd/infra/.secrets/staff-postgres-full.env \
  scripts/migrate --tcp
```
