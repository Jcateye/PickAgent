# Review 工作台与报告中心 API 切片

日期：2026-05-24

## 范围

本切片对应 `docs/backend-capability-work-allocation.md` 的 Workstream F：Review & Reports。

接口边界：

- Review：`GET /api/reviews`、`GET /api/reviews/{reviewItemId}`、`POST /api/reviews`、`PATCH /api/reviews/{reviewItemId}`、`POST /api/reviews/{reviewItemId}/decision`
- Reports：`GET /api/reports`、`POST /api/reports`、`GET /api/reports/{reportId}`、`GET /api/reports/{reportId}/versions`、`GET /api/reports/{reportId}/versions/{versionId}`、`POST /api/reports/{reportId}/export`、`POST /api/reports/{reportId}/subscriptions`

## 分层

- Contract：`apps/contracts/types/reviewReportCenter.ts` 定义 Review 列表/详情、报告详情/版本、导出任务、订阅 DTO。
- Route：`apps/frontend/src/app/api/**` 只负责 query/body parse、P0 auth context、调用 service、统一 envelope。
- Service：`FinalReviewService` 和 `FinalReportService` 负责 DTO assembler、分页、详情、审批决策、报告版本、导出和订阅 shell。
- Repository/Adapter：内存 repository 提供本地 smoke；Prisma adapter 走已有 `reviewItem`、`workflowRun`、`report`、`reportVersion` delegate，未新增表。

## 审计与约束

- Review 创建、修改、决策都会写入 `WorkflowRun`/内存 workflow audit。
- 报告生成会保存稳定 `ReportDetailDto` snapshot 和版本。
- 导出接口 P0 只返回 `PENDING` job，不生成真实文件。
- 订阅接口 P0 只保存配置，不发邮件。
- 本切片不做自动改价、自动报名、自动修改商品信息。

## Changelog

- 新增 Review 工作台详情 DTO，包含建议、风险、证据、相关规则/Run 和审批历史。
- 新增报告中心列表、详情、版本、导出和订阅 API shell。
- 新增 service smoke：`apps/backend/tests/unit/reviewReportCenterService.test.ts`。
