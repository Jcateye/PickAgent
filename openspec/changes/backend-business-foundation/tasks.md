## 1. Shared contracts, schemas, and fixtures

- [ ] 1.1 定义 ingest payload、SKU summary/detail、Rule DSL、simulation、review、report 和 agent tool 的最小 DTO / Zod schema
- [ ] 1.2 准备一套覆盖插件采集、健康查询、活动模拟、Review 和 Agent 工具调用的 seed fixture

## 2. Ingest and health projection foundation

- [ ] 2.1 实现 `NormalizationService` 与 `IngestService`，完成建档、写 snapshot、保留 raw/normalized JSON
- [ ] 2.2 实现 `HealthAssessmentService` 与 `SkuQueryService`，输出 health summary、SKU list/detail 和 `CurrentSkuProjection`

## 3. Rule and simulation foundation

- [ ] 3.1 实现 `ActivityRuleService` 的 Canonical Rule DSL 校验、parse status、confidence 和错误回退
- [ ] 3.2 实现 `ActivitySimulationService` 的准入状态、失败规则、evidence、repair suggestion 和 what-if 对比

## 4. Review, report, and agent tool foundation

- [ ] 4.1 实现 `ReviewService` 的 ReviewItem 生成、决策流转和来源对象关联
- [ ] 4.2 实现 `ReportService` 的健康/活动报告预览 DTO、章节结构和 evidence summary
- [ ] 4.3 实现 `AgentToolRegistry` 最小工具集合与 fake/runtime adapter 边界，工具内部复用 application service

## 5. Readiness and verification

- [ ] 5.1 为 ingest、projection、rule、simulation、review、report 和 agent tools 补最小单元测试
- [ ] 5.2 运行 `scripts/typecheck` 与 `scripts/test`，记录未覆盖原因或阻塞项
- [ ] 5.3 输出下游模块解锁清单，明确哪些真实接入项已经“已完成，不阻塞”
