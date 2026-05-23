# final-activity-simulation-closure 交接文档

日期：2026-05-24

## 完成范围

- Activities 页面已从旧 `/api/activity-workbench` 聚合入口切换到真实冻结 API：
  - `GET /api/skus`
  - `GET /api/skus/:skuProfileId`
  - `POST /api/activities/parse`
  - `POST /api/activities/:activityRuleSetId/simulations`
  - `POST /api/reviews`
  - `POST /api/reports`
- simulation 和 what-if 均通过 `POST /api/activities/:activityRuleSetId/simulations` 执行。
- `MANUAL_REVIEW` 对象详情提供“创建或定位 Review item”入口；创建后可跳转 Review 工作台。
- rule、simulation result、snapshot/evidence refs 已映射为可点击来源链接。
- 删除旧 `/api/activity-workbench` route，避免 fake runtime 成为活动页默认路径。

## Route / API

- `POST /api/activities/parse`
  - 入参：`{ name, platform?, sourceText, rules? }`
  - 出参 envelope：`ActivityRuleSetDto`
- `POST /api/activities/:activityRuleSetId/simulations`
  - 入参：`{ skuProfileIds, whatIf? }`
  - 出参 envelope：`ActivitySimulationRunDto`
- `POST /api/reviews`
  - 入参：`{ items: Omit<ReviewItemDto, "reviewItemId" | "status">[] }`
  - 出参 envelope：`ReviewItemDto[]`
- `POST /api/reports`
  - 入参：`{ type: "ACTIVITY", skuProfileIds, simulationResultIds }`
  - 出参 envelope：`ReportPreviewDto`

## Fallback

- 页面保留 deterministic fallback UI，仅用于没有 ingest 数据、route 失败或本地开发异常时保持页面可读。
- 生产默认链路不再使用 `/api/activity-workbench`，也不把 mock/fake runtime 声明为真实完成路径。
- 当前 foundation 仍是 in-memory persistence；刷新 dev server 后需要先通过 `/api/ingest` 写入 SKU，Activities 才能运行真实 simulation。

## 验证

- `openspec validate final-activity-simulation-closure --strict`：通过。
- `./scripts/typecheck frontend`：通过。
- `./scripts/lint frontend`：通过。
- `./scripts/build frontend`：通过。
- `./scripts/typecheck backend`：通过。
- `npx --yes -p tsx tsx --test apps/backend/tests/unit/finalApiPersistenceFoundation.test.ts apps/backend/tests/unit/finalActivitySimulationClosure.test.ts`：通过，3 个测试全部 pass。

## HTTP Smoke

Dev server：

```bash
NODE_OPTIONS=--no-experimental-webstorage pnpm --dir apps/frontend exec next dev -p 3017
```

HTTP 链路：

1. `POST /api/ingest`
2. `POST /api/activities/parse`
3. `POST /api/activities/:activityRuleSetId/simulations`
4. `POST /api/reviews`
5. `POST /api/reports`
6. `GET /activities`

结果摘要：

```json
{
  "ruleSetId": "rules_0004",
  "simulationRunId": "simulation_run_0007",
  "eligibility": ["MANUAL_REVIEW", "MANUAL_REVIEW"],
  "reviewItems": ["review_0008", "review_0009"],
  "reportId": "report_0010"
}
```

日志与临时证据：

- `/tmp/final-activity-simulation-closure-next.log`
- `/tmp/final-activity-ingest-response.json`
- `/tmp/final-activity-parse-response.json`
- `/tmp/final-activity-simulation-response.json`
- `/tmp/final-activity-review-response.json`
- `/tmp/final-activity-report-response.json`
- `/tmp/final-activity-page.html`

## 风险

- 非阻塞 L1：`docs/operations/pickagent-final-design-work-allocation.md` 在当前 worktree 缺失；本次按 OpenSpec、tracker 可用文档和两个 foundation handoff 执行。
- 非阻塞 L1：当前 API persistence foundation 是 in-memory；这不阻塞 Layer 4B/4C/4D，但生产化仍需后续 PostgreSQL/Prisma adapter 保持相同 contract。
- 非阻塞 L1：页面 SSR 初始 HTML 会先显示 fallback 状态，hydration 后通过真实 API 更新；HTTP route smoke 已覆盖真实链路。

## 结论

`final-activity-simulation-closure` 的 tasks 5.1 至 5.5 已完成，可声明“不阻塞 Layer 4B/4C/4D”。
