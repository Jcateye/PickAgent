# final-api-persistence-foundation 下游解锁清单

日期：2026-05-23

## 已冻结 route / DTO

- `POST /api/ingest`：接收 `IngestPayloadDto`，返回 `IngestResponseDto`，包含 summaries、snapshots、diagnoses、workflowRunId。
- `GET /api/health/summary`：返回 `HealthSummaryDto`。
- `GET /api/skus`：返回 `PageDto<SkuSummaryDto>`。
- `GET /api/skus/:skuProfileId`：返回 `SkuDetailDto`。
- `POST /api/activities/parse`：接收规则文本，返回 `ActivityRuleSetDto`。
- `POST /api/activities/:activityRuleSetId/simulations`：接收 skuProfileIds / whatIf，返回 `ActivitySimulationRunDto`。
- `GET /api/reviews`：返回 `PageDto<ReviewItemDto>`。
- `POST /api/reviews/:reviewItemId/decision`：接收 `ReviewDecisionRequestDto`，返回 `ReviewItemDto`。
- `POST /api/reports`：接收 `ReportRequestDto`，返回 `ReportPreviewDto`。

所有 route 使用统一 envelope：`{ code, message, data, requestId }`。

## 可启动的 Layer 4B 模块

- `final-browser-ingest-validation`：可切到真实 `POST /api/ingest` DTO。
- `final-staff-health-api-closure`：可消费 `GET /api/health/summary`、`GET /api/skus`、`GET /api/skus/:skuProfileId`。
- `final-activity-simulation-closure`：可消费 parse / simulation route。
- `final-review-reporting-closure`：可消费 reviews / reports route。

## 仍需等待

- `final-copilot-overlay-closure` 仍需等待 `final-agent-eventstore-foundation` 的 EventStore / SSE / Agent run contract。
- `final-pi-tool-policy-poc` 仍需等待 EventStore、ToolExecutor、Overlay 基本可用。

## 风险

- L1：当前 transaction foundation 使用 in-memory repository，满足本 change 允许的最小 foundation；切 PostgreSQL/Prisma 真实 adapter 时需保持相同 repository interface。
- L1：HTTP smoke 需要 Next dev server；本次以 route typecheck、service/repository 单测和 frontend typecheck 覆盖 route binding。
