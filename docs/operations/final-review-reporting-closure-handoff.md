# final-review-reporting-closure 交接文档

日期：2026-05-24

## 完成范围

- Review 工作台默认消费 `GET /api/reviews`，列表、详情和 evidence summary 来自持久化 Review DTO。
- Review 决策动作默认提交 `POST /api/reviews/:reviewItemId/decision`，刷新后仍可从 `GET /api/reviews` 读到已保存决策状态。
- Reports 首屏不再创建前端 runtime snapshot；SSR 首屏使用确定性 fixture，hydration 后通过稳定 snapshot request 调用 `POST /api/reports`。
- Reports evidence summary 和 Reviews 对象入口均提供可定位链接，覆盖 source object、rule、simulation、review、workflow/tool trace 的路由归属。
- 新增 hydration smoke：`apps/frontend/tests/final-review-reporting-hydration-smoke.spec.mjs`。

## Route / API

- `GET /api/reviews`
  - 返回 `{ code, message, data, requestId }`，`data` 为 `PageDto<ReviewItemDto>`。
  - 默认 runtime seed 来自 `businessFoundationSeedFixture`、activity parse/simulation 和 ReviewService create。
- `POST /api/reviews/:reviewItemId/decision`
  - 入参：`ReviewDecisionRequestDto`。
  - 出参：更新后的 `ReviewItemDto`。
- `GET /api/reports/snapshot`
  - 返回稳定 `ReportRequestDto`，用于前端生成报告 preview 请求。
- `POST /api/reports`
  - 入参：`ReportRequestDto`。
  - 出参：`ReportPreviewDto`。

## Fallback

- Review 页面保留确定性 `mockReviewItems` 作为 API 加载失败 fallback，但页面文案会标记 `fixture fallback`。
- Reports 页面保留确定性 `mockReportPreview` 作为 SSR 首屏和 API 失败 fallback；生产默认 preview 仍走 `POST /api/reports`。
- 本 change 未把 mock/fake runtime 声明为生产默认路径。

## 验证命令

- `openspec validate final-review-reporting-closure --strict`：通过。
- `./scripts/typecheck frontend`：通过。
- `./scripts/lint frontend`：通过。
- `./scripts/build frontend`：通过。
- `./scripts/typecheck backend`：通过。
- `npx --yes -p tsx tsx --test apps/backend/tests/unit/finalApiPersistenceFoundation.test.ts`：通过，2 个测试 pass。
- `pnpm --dir apps/frontend test:hydration`：通过，Chromium smoke 验证 Reports / Reviews 均显示 `API ready`，React hydration error 数量为 0。

## Smoke 证据

- API smoke JSON：
  - `/tmp/final-review-reporting-reviews-before.json`
  - `/tmp/final-review-reporting-decision.json`
  - `/tmp/final-review-reporting-reviews-after.json`
  - `/tmp/final-review-reporting-report-snapshot.json`
  - `/tmp/final-review-reporting-report-request.json`
  - `/tmp/final-review-reporting-report-preview.json`
- Dev server 日志重点：
  - `GET /api/reviews 200`
  - `POST /api/reviews/review_0008/decision 200`
  - `GET /api/reports/snapshot 200`
  - `POST /api/reports 200`
  - `GET /reviews 200`
  - `GET /reports 200`

## 风险

- 非阻塞风险：当前 foundation persistence 仍是 in-memory runtime，符合上游 `final-api-persistence-foundation-handoff.md` 的 L1 风险；后续替换 PostgreSQL/Prisma adapter 时需保持 route DTO 和 repository interface 不变。
- 非阻塞风险：要求中引用的 `docs/operations/pickagent-final-design-work-allocation.md` 在当前 worktree 不存在，本次读取并遵循了 `docs/operations/pickagent-final-design-execution-tracker.md` 中同一 Layer 4B 分工表。
- 无阻塞项；可声明不阻塞 Layer 4B / 4C / 4D。
