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
- 业务代码与 Prisma schema 尚未正式初始化
- 当前以单应用服务端实现优先，后续如确有收益再拆具体模块
