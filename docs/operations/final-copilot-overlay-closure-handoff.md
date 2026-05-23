# final-copilot-overlay-closure 交接文档

日期：2026-05-24

## 完成范围

- 完成 `apps/frontend/src/modules/agent-copilot/` 模块拆分，`/agent-chat` 仅保留为兼容入口并复用同一 `AgentCopilotWorkbench`。
- 在 console layout 注入 `AgentCopilotProvider`、floating bubble 与常驻 sidecar panel。
- Dashboard、SKU、Activities、Reviews、Reports 已注册 `WorkbenchContext`，包含 `route`、`pageTitle`、`selectedEntity`、`visibleFilters`、`visibleColumns`。
- `useAgentRunEvents(runId)` 已实现 EventStore JSON replay、SSE 消费和 SSE 断开后的 `after=lastSequence` polling replay fallback。
- Review Gate next action 已展示并链接：
  - gate anchor：`#agent-gate-{gateId}`
  - review item：`/reviews?reviewItemId={reviewItemId}`
  - run trace：`/workflows?runId={runId}`
  - continuation run：`/workflows?runId={continuationRunId}`

## Route / API

- `GET /api/agent/runs/:runId/events?after=<sequence>`
  - JSON replay：返回 `{ code, message, data: { items, after }, requestId }`。
  - SSE：当 `Accept: text/event-stream` 或 `stream=1` 时返回 `text/event-stream`，事件格式为 `id / event / data`。
- `POST /api/agent/missions`
- `POST /api/agent/missions/:missionId/runs`
- `POST /api/agent/review-gates/:gateId/decision`

## Fallback

- UI 允许 fixture fallback 展示 sidecar、context、trace、review gate 和 continuation 链接。
- 生产路径不把 mock / fake runtime 声明为默认；真实事件路径通过 EventStore replay/SSE contract。
- 当前 EventStore foundation 仍是 in-memory runtime，后续 PostgreSQL/Prisma adapter 替换时需保持 route contract 不变。

## 验证命令

- `openspec validate final-copilot-overlay-closure --strict`：通过。
- `scripts/typecheck agent-workbench`：通过。
- `scripts/lint agent-workbench`：通过。
- `scripts/build agent-workbench`：通过。
- HTTP smoke：
  - `POST /api/agent/missions` 创建 mission：通过。
  - `POST /api/agent/missions/:missionId/runs` 创建 run：通过。
  - `GET /api/agent/runs/:runId/events?after=0` replay 返回 `run.started`：通过。
  - `GET /api/agent/runs/:runId/events?after=0&stream=1` SSE 返回 `id/event/data`：通过。

## 截图路径

- `docs/operations/artifacts/final-copilot-overlay-closure/dashboard-desktop-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/dashboard-mobile-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/sku-desktop-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/sku-mobile-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/activities-desktop-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/activities-mobile-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/reviews-desktop-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/reviews-mobile-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/reports-desktop-overlay.png`
- `docs/operations/artifacts/final-copilot-overlay-closure/reports-mobile-overlay.png`

## 风险

- 非阻塞：sidecar 当前以 fixture 状态展示 plan/trace/gate 内容；真实 Pi runtime 的持续增量事件仍依赖后续 Layer 4C/4D 接入。
- 非阻塞：EventStore foundation 仍是 in-memory，不能声明为生产持久化默认路径。
- 非阻塞：截图使用临时 `/tmp/pickagent-pw` Playwright 运行环境生成，没有把 Playwright 加入项目依赖。

## 结论

可声明：`final-copilot-overlay-closure` 已完成，不阻塞 Layer 4B/4C/4D。
