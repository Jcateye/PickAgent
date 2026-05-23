# PickAgent 最终联调验收结论

日期：2026-05-23

OpenSpec change：`cross-module-integration-and-acceptance`

## 结论

PickAgent 当前并行计划的 Layer 1 / Layer 2 / Layer 3 已完成统一收口，Layer 4 主链路联调通过。当前可以声明：**PickAgent 当前并行计划已完成，不阻塞**。

本结论不等同于生产化完成。真实数据库事务落库、生产 API 鉴权、真实 Pi/Hermes runtime、真实抖店页面操作参数和价格/类目补齐仍按生产化风险继续跟踪，但不阻塞当前验收闭环。

## 主链路验收结果

| 链路 | 结果 | 验收证据 |
|---|---:|---|
| 后端业务基座 readiness | 通过 | `docs/backend-business-foundation-readiness.md` 已声明 Layer 2 application service、contract、fixture、Agent tool registry 不阻塞；`backendBusinessFoundation.test.ts` 覆盖 ingest、projection、simulation、review、report、agent tools。 |
| 抖店插件 -> ingest -> SKU 健康工作台 | 通过 | `mapDouyinBusinessHttpRecords` 可把 `source/business-http-records-2026-05-23-11-53-35.json` 映射为 SKU rows；integration smoke 验证 rows 进入 `IngestService` 后生成 summary/detail/snapshot/raw fxg evidence。 |
| 活动规则 -> 模拟 -> Review -> 报告 | 通过 | integration smoke 验证商机线索进入 `manual_review` rule，simulation 产生 `MANUAL_REVIEW`，Review item 打开并可决策为 `CHANGES_REQUESTED`，报告生成 `unresolved_risks`。 |
| 员工工作台上下文 -> Agent Mission -> Agent tool -> Review Gate | 通过 | integration smoke 验证 `AgentToolRegistry` 只暴露 5 个业务工具，`getSkuSummary` 经 application service 成功，fake runtime mission 暂停在 Review Gate，批准后同一 contract 完成。 |
| 最终演示脚本与技术验收清单 | 通过 | 本文档记录演示脚本、验证命令、遗留风险和回流模块；新增 integration smoke 作为技术验收脚本。 |

## Layer 3 遗留项处理

| 遗留项 | 分类 | 说明 |
|---|---:|---|
| `/stock/manage/list` 最大 page size、筛选参数、排序参数真实页面操作确认 | 非阻塞风险 | 当前 adapter 已实现受控分页和参数保留；需要真实商家后台操作样本继续确认，不阻塞离线记录到 ingest 主链路。 |
| 抖店状态码字典页面对照 | 非阻塞风险 | 插件和后端当前只保留原始状态码，不在插件侧翻译业务结论；不阻塞 health/simulation/review 链路。 |
| `sku_stock_diagnose` 批量上限和频率限制 | 非阻塞风险 | 当前按商品批量提交并把 `is_alarming` 作为采集层 evidence；真实上限需生产化前验证。 |
| 库存接口缺少 sale price | 非阻塞风险 | 当前以采集风险展示，不用价格做当前硬阻塞判断；后续需要商品详情或价格接口补齐。 |
| 库存接口缺少类目名称 | 非阻塞风险 | 当前保留 `category_id` 并以采集风险展示；后续需要类目字典或商品详情接口补齐。 |
| 数据库 repository / transaction / Prisma 真实落库 | 非阻塞风险 | 当前验收范围是 application service + in-memory store 的业务闭环；生产 API 与事务落库归 P2 生产化。 |
| 生产 API route 与鉴权 | 非阻塞风险 | 当前不声明生产鉴权完成；本验收只验证模块 contract 和 application service 可连通。 |
| 真实 Pi/Hermes runtime 联调 | 非阻塞风险 | fake runtime adapter 已接真实 `AgentToolRegistry` 并保持 Mission / Run / Event / Gate contract；生产 runtime 后续接同一 adapter contract。 |
| 截图/录屏证据 | 非阻塞风险 | 当前技术验收以 typecheck/test/build 和 integration smoke 为准；如要外部演示归档，需要补 UI 截图或录屏。 |

当前没有阻塞项。

## 演示脚本

1. 打开抖店库存管理采集记录，说明主数据源为 `POST /stock/manage/list`，SKU 诊断为 `POST /stock/manage/sku_stock_diagnose`，商机中心只作为活动线索。
2. 运行 integration smoke，展示抖店 HTTP 记录被映射为标准 SKU ingest rows，并进入 `IngestService`。
3. 展示 SKU summary/detail 中的 health status、snapshot evidence 和 `raw.fxg` 采集证据。
4. 输入包含库存门槛与 `business_chance_center` 的活动规则，展示 rule set 为 `NEEDS_REVIEW`。
5. 运行 simulation，展示 `MANUAL_REVIEW` 风险进入 Review item，并生成 activity report preview 的 `unresolved_risks`。
6. 启动 Agent mission，展示业务工具只来自 `AgentToolRegistry`，通用 `coding/file/bash` 工具禁用，run 停在 Review Gate。
7. 人工批准 Review Gate，展示 mission 在同一 contract 下完成，不静默执行高风险业务动作。

## 验收命令

```bash
npx --yes tsx --test apps/backend/tests/unit/backendBusinessFoundation.test.ts apps/backend/tests/integration/crossModuleAcceptanceSmoke.test.ts
scripts/typecheck backend
scripts/typecheck frontend
scripts/typecheck extension
scripts/test backend
scripts/test frontend
scripts/test extension
scripts/build backend
scripts/build frontend
scripts/build extension
PORT=3104 pnpm --dir apps/frontend start
curl -sS -X POST http://localhost:3104/api/activity-workbench -H 'content-type: application/json' --data '{"sourceText":"活动库存不得低于 80 件，business_chance_center 商机线索需要人工确认。"}'
```

## 回流修复归属

| 模块/分支 | 事项 | 回归方式 |
|---|---|---|
| 浏览器插件真实 ingest | 抖店页面真实分页、筛选、排序、状态码字典、SKU 诊断批量上限 | 使用真实商家后台页面操作录制新脱敏 fixture，回归 extension fixture smoke 和 cross-module integration smoke。 |
| 后端生产化数据层 | Prisma repository、transaction、生产 API route、鉴权 | 增加 repository/API integration test，再回归 backend typecheck/test 和 cross-module integration smoke。 |
| Agent runtime 集成 | 真实 Pi/Hermes runtime 接入当前 adapter contract | 使用同一 Mission / Run / Event / Gate DTO 回归 Agent workbench smoke，确认只暴露业务工具。 |
| 活动规则数据补齐 | sale price 与类目名称来源 | 新增价格/类目来源 fixture，回归 ingest mapping、health detail 采集风险和 activity simulation。 |

## OpenSpec 需求状态

| Requirement | 状态 |
|---|---:|
| Integration readiness gates | 已完成，不阻塞 |
| Fixed cross-module integration order | 已完成，不阻塞 |
| Blocker tracking and regression verification | 已完成，不阻塞 |
| Final acceptance handoff | 已完成，不阻塞 |
| Readiness evidence template | 已完成，不阻塞 |
