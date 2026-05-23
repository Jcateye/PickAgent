# Backend Business Foundation Readiness

## Layer 2 Scope

本清单覆盖 `backend-business-foundation` 的 Layer 2：后端真实业务能力层。当前仍不接外部生产接口，但已经提供可复用的离线 HTTP 记录 adapter、标准 ingest 映射、健康投影、活动规则/模拟、Review/报告和 Agent tool service 边界。

## 已完成，不阻塞

- `browser-extension-full-ingest`：已有 `IngestPayloadDto`、fixture、`IngestService` 闭环，以及 `mapDouyinBusinessHttpRecords` 可把抖店 `stock/manage/list` / `sku_stock_diagnose` 抓取记录离线映射为标准 rows。
- `staff-workbench-health-console`：已有 `SkuSummaryDto`、`SkuDetailDto`、`SkuQueryService` 与 health summary/list/detail 当前读模型；抖店库存字段可进入 `CurrentSkuProjection`。
- `staff-workbench-activity-simulation`：已有 Canonical Rule DSL、parse status/confidence/errors、simulation 和 what-if DTO/service；`business_chance_center` 商机线索已映射为 `manual_review` 规则线索。
- `staff-workbench-review-reporting`：已有 `ReviewItemDto`、决策流转、`ReportPreviewDto`、章节结构与 evidence summary。
- `agent-copilot-workbench`：已有 `AgentToolRegistry` 最小工具集合与 fake/runtime adapter 边界，工具通过 application service 执行，不直接访问 repository 或数据库。

## 仍然显式阻塞

- 真实平台 API、ERP 接口、权限系统、自动改价/报名/修改商品信息不在本 change 范围内。
- 真实数据库事务、Prisma repository 接线和生产 API route 仍需进入后续集成层；当前 Layer 2 用内存 store 验证业务 service 与 contract。
- 真实 Pi/Hermes runtime 联调不在本 change 范围内；当前只声明 fake/runtime adapter contract 不阻塞 UI 接线。

## 基于 `source/business-http-records-2026-05-23-11-53-35.json` 的字段映射

- `POST /stock/manage/list`：`product_id` → `raw.fxg.productId`，`product_name` + `skus[].sku_name` → `productName`，`skus[].sku_id` → `externalSkuId`，`skus[].total_unoccupied_stock_num` / `total_stock_num` → `stock`，`check_status=3` → `certificateStatus=valid`，`tags` → `raw.fxg.stockTags`。
- `POST /stock/manage/sku_stock_diagnose`：`product_id` / `sku_id` 关联库存列表行，`is_alarming` → `raw.fxg.isAlarming`。
- `POST /api/commop/business_chance_center/clue/common/real_time_list`：`clue_detail.name`、`category_path`、`price_min/price_max`、`clue_label_list` 映射为商机/活动规则线索；当前以 `manual_review` 规则进入 ActivityRuleService。

## 判定

Layer 2 backend 已完成，不阻塞插件真实 ingest、健康工作台真实查询、活动模拟真实 parse/simulation、Review/报告真实接口和 Agent tools 接线；不能声明真实外部生产接口联调、数据库事务落库或 Pi/Hermes runtime 联调完成。
