# final-cross-module-acceptance 验收报告（Layer 4D）

日期：2026-05-24  
OpenSpec change：`final-cross-module-acceptance`

## 总结结论

- `L4 accepted`：是。
- `P0 blocker`：无。
- `P1 risk`：有（见“风险与回流清单”），均为非阻塞。

本次验收严格按固定主链路执行：

1. 链路 A：插件到 ingest / projection / Dashboard / SKU detail。  
2. 链路 B：活动规则到 simulation / Review / Reports。  
3. 链路 C：WorkbenchContext 到 Agent sidecar / SSE / Review Gate contract。  
4. 链路 D：Pi adapter 到 ToolExecutor / application service / evidence / continuation replay。  

---

## 9.1 统一 seed / fixture / 验收脚本 / 证据目录

已准备并验证：

- 统一 fixture 生成脚本：
  - `scripts/final-cross-module-acceptance-prepare-fixtures.mjs`
- 统一 HTTP smoke 脚本：
  - `scripts/final-cross-module-acceptance-http-smoke.mjs`
- 浏览器桌面/移动截图脚本：
  - `apps/frontend/tests/final-cross-module-acceptance-browser.spec.mjs`
- 统一 fixture：
  - `output/final-cross-module-acceptance/fixtures/ingest-payload.json`
  - `output/final-cross-module-acceptance/fixtures/activity-parse-request.json`
  - `output/final-cross-module-acceptance/fixtures/source-endpoints.json`
- 证据目录：
  - `output/final-cross-module-acceptance/http-smoke/`
  - `output/final-cross-module-acceptance/browser/`
  - `output/final-cross-module-acceptance/runtime/`

---

## 9.2 链路 A 验证结果（插件 -> ingest -> projection -> Dashboard/SKU detail）

输入与关键 route：

- 输入：`output/final-cross-module-acceptance/fixtures/ingest-payload.json`
- `POST /api/ingest`
- `GET /api/health/summary`
- `GET /api/skus?page=1&pageSize=100`
- `GET /api/skus/:skuProfileId`

关键对象与结果（摘自 `summary.json`）：

- `workflowRunId = workflow_0013`
- 本次提交 `acceptedRows = 4`
- `healthTotal = 6`
- `skuListTotal = 6`
- `firstSkuProfileId = sku_0009`
- `firstSkuPlatform = doudian`

证据：

- `output/final-cross-module-acceptance/http-smoke/chain-a-01-ingest-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-a-02-health-summary-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-a-03-sku-list-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-a-04-sku-detail-response.json`

---

## 9.3 链路 B 验证结果（规则 -> simulation -> Review -> Reports）

输入与关键 route：

- 输入：`output/final-cross-module-acceptance/fixtures/activity-parse-request.json`
- `POST /api/activities/parse`
- `POST /api/activities/:activityRuleSetId/simulations`
- `POST /api/reviews`
- `POST /api/reviews/:reviewItemId/decision`
- `POST /api/reports`

关键对象与结果：

- `ruleSetId = rules_0014`
- `parseStatus = NEEDS_REVIEW`
- `simulationRunId = simulation_run_0018`
- `simulationResultCount = 3`
- `reviewItemId = review_0019`
- `reviewDecisionStatus = CHANGES_REQUESTED`
- `reportId = report_0021`
- `reportStatus = PREVIEW`

证据：

- `output/final-cross-module-acceptance/http-smoke/chain-b-01-activity-parse-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-b-02-activity-simulation-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-b-03-review-create-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-b-04-review-decision-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-b-05-report-preview-response.json`

---

## 9.4 链路 C 验证结果（WorkbenchContext -> sidecar / SSE / Review Gate contract）

关键 route：

- `POST /api/agent/missions`
- `POST /api/agent/missions/:missionId/runs`
- `GET /api/agent/runs/:runId/events?after=0`
- `GET /api/agent/runs/:runId/events?after=0&stream=1`

关键结果：

- `missionId = agent_mission_0002`
- `runId = agent_run_0003`
- replay 事件数：`1`（包含 `run.started`）
- SSE 证据包含 `event: run.started`，验证 sidecar 消费 contract 可用

证据：

- `output/final-cross-module-acceptance/http-smoke/chain-c-01-agent-mission-create-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-c-02-agent-run-start-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-c-03-agent-events-replay-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-c-04-agent-events-sse-response.txt`

浏览器截图（含 Agent Copilot 页面）：

- `output/final-cross-module-acceptance/browser/desktop-agent-chat.png`
- `output/final-cross-module-acceptance/browser/mobile-agent-chat.png`

---

## 9.5 链路 D 验证结果（Pi/fake fallback -> ToolExecutor -> application service -> evidence）

关键 route：

- `POST /api/agent/pi/smoke`
- `POST /api/agent/review-gates/:gateId/decision`
- `GET /api/agent/runs/:runId/events?after=0`
- `GET /api/agent/runs/:continuationRunId/events?after=0`

关键结果：

- `piRunId = agent_run_0007`
- `reviewGateId = agent_gate_0017`
- `gateStatus = APPROVED`
- `continuationRunId = agent_run_0022`
- `piVisibleTools = [parseActivityRules, simulateActivityReadiness, explainDecisionWithEvidence]`
- `disabledRuntimeTools = [coding, file, bash]`
- 原 run 事件数：`9`
- continuation 事件数：`1`（`run.continuation_started`）

证据：

- `output/final-cross-module-acceptance/http-smoke/chain-d-01-pi-smoke-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-d-02-review-gate-decision-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-d-03-run-events-response.json`
- `output/final-cross-module-acceptance/http-smoke/chain-d-04-continuation-events-response.json`

---

## 浏览器桌面/移动截图结果

命令执行通过：`2 passed`。  
证据：

- `output/final-cross-module-acceptance/browser/playwright-run.log`
- `output/final-cross-module-acceptance/browser/desktop-dashboard.png`
- `output/final-cross-module-acceptance/browser/desktop-sku-health.png`
- `output/final-cross-module-acceptance/browser/desktop-activities.png`
- `output/final-cross-module-acceptance/browser/desktop-reviews.png`
- `output/final-cross-module-acceptance/browser/desktop-reports.png`
- `output/final-cross-module-acceptance/browser/desktop-agent-chat.png`
- `output/final-cross-module-acceptance/browser/mobile-dashboard.png`
- `output/final-cross-module-acceptance/browser/mobile-sku-health.png`
- `output/final-cross-module-acceptance/browser/mobile-agent-chat.png`

---

## 验证命令与结果

- `openspec validate final-cross-module-acceptance --strict`：通过。
- `node scripts/final-cross-module-acceptance-http-smoke.mjs`：通过，A/B/C/D 全链路成功。
- `npx --yes -p tsx tsx --test apps/backend/tests/integration/crossModuleAcceptanceSmoke.test.ts`：通过（1/1）。
- `pnpm --dir apps/frontend exec playwright test tests/final-cross-module-acceptance-browser.spec.mjs --browser=chromium --reporter=line`：通过（2/2）。

---

## 风险与回流清单（9.6）

### P0 blocker（阻塞）

- 无。

### P1 risk（非阻塞风险）

1. in-memory runtime 仍是默认验收存储，服务重启后数据会清空。  
回流模块：`final-api-persistence-foundation`（保持 route/DTO 不变前提下替换 PostgreSQL/Prisma adapter）。

2. `finalApiRuntime` 初始化会注入默认 seed，导致链路 A 总数大于本次 ingest 行数（本次 4 行，summary total=6）。  
回流模块：`final-staff-health-api-closure` / `final-cross-module-acceptance` 后续可加“纯净模式”开关，便于隔离验收数据。

3. 当前截图是本地开发态证据（Next dev），用于验收链路可见性，不代表生产部署态性能指标。  
回流模块：`final-cross-module-acceptance` 后续可补 build/start 模式截图对照（非阻塞）。

---

## 最终判定

- `L4 accepted`：是。  
- 可声明：`final-cross-module-acceptance` 已完成，当前无 P0 阻塞项，不阻塞后续归档与收口。
