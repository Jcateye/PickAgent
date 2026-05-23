## Context

现有主线已经确认服务端拥有业务真相，前端、插件和 Agent 只能消费 DTO、projection 或 Tool Registry。当前仓库已有数据库模型、CRUD service、OpenAPI scaffold 和页面壳，但还缺少把 CRUD 组合成业务闭环的 application service 与 domain evaluator。

为了不让各业务模块在最后联调时同时阻塞，本 change 只实现跨模块共享的最小后端业务基座。它不替代各业务模块本身，也不把后端拆成一个过大的交付模块；它只交付可被上层业务模块稳定消费的基础能力。

## Goals / Non-Goals

**Goals:**
- 提供 ingest → normalization → health diagnosis → current projection 的最小链路。
- 提供 Rule DSL 校验、活动模拟、what-if 和 manual review 输出的最小链路。
- 提供 Review 决策、报告预览 DTO 和结构化 evidence 的最小链路。
- 提供 AgentToolRegistry 和 fake/runtime adapter 边界，让 Agent 工作台能调用同一批业务 service。
- 提供共享 fixture、contract 校验和单元测试，作为上层模块“已完成且不阻塞”的依据。

**Non-Goals:**
- 不做完整权限系统。
- 不接真实天猫、京东或 ERP 生产 API。
- 不自动改价、自动报名或自动修改商品详情。
- 不引入新的后端基础设施。
- 不在本 change 中实现员工工作台、插件或 Agent UI。

## Decisions

1. 基座以 application service 为交付单位，但每个 service 必须对应一个业务用例链路，而不是裸 CRUD 包装。
2. `IngestService` 接收插件标准 payload 后，必须完成建档、写快照、诊断、更新 `CurrentSkuProjection`。这样插件和健康工作台可以通过同一事实链路联调。
3. `ActivityRuleService` 输出 Canonical Rule DSL，并用 Zod 校验。LLM 或 mock parser 只能作为输入来源，不能绕过 DSL 校验。
4. `ActivitySimulationService` 只产生活动上下文准入结论，不覆盖长期 `SkuHealthDiagnosis`。
5. `ReviewService` 统一生成和处理 `ReviewItem`，上游模块只能生成 review intent 或 manual review 输出，正式审批状态由本 service 维护。
6. `ReportService` 第一版只交付预览 DTO 与 evidence summary，不要求完整文件导出。
7. Agent 工具通过 `AgentToolRegistry` 暴露，工具内部调用同一批 application service，不允许 Agent 直接访问 repository 或数据库。
8. Hermes 工程若作为外部 runtime 存在，本仓只通过 `AgentLoopAdapter` / `AgentToolRegistry` contract 接入；未接真实 Hermes/Pi 时，fake provider 可支撑 Agent UI 不阻塞，但不能声明真实工具联调完成。

## Risks / Trade-offs

- [基座 scope 过大] → 只实现 P0 主闭环所需 service，不做平台连接器框架、权限系统或真实外部 API。
- [上层模块仍然被后端时序阻塞] → 所有上层模块继续 mock 先行，只有真实接口替换步骤依赖本 change。
- [Rule parse 依赖 LLM 不稳定] → P0 可先提供 deterministic/mock parser，但输出必须是同一 Rule DSL。
- [Agent runtime 接入不确定] → fake runtime 与真实 runtime 使用同一 adapter contract，真实接入放到 Agent 模块尾部和跨模块联调验证。

## Migration Plan

1. 冻结共享 DTO、Zod schema 和 fixture。
2. 实现 ingest / health projection 链路并用 fixture 测试。
3. 实现 rule / simulation / what-if 链路并用 fixture 测试。
4. 实现 review / report 链路并用 fixture 测试。
5. 实现 AgentToolRegistry 最小工具集合和 fake adapter。
6. 运行 scripts/typecheck 与 scripts/test，输出下游模块解锁清单。

## Open Questions

- 第一批 Rule DSL 是否只支持 deterministic parser，还是同时接入 LLM mock adapter。
- 第一版报告是否需要生成持久化 `Report` 主体，还是只返回 DTO。
- Agent 第一批工具最小集合是否限定为 `getSkuSummary`、`parseActivityRules`、`runSimulation`、`createReviewItems`、`generateReportPreview`。
