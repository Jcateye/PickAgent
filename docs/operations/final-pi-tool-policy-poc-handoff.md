# final-pi-tool-policy-poc 交接

## 已完成 requirement

- 8.1 `runSimulation` 作为兼容别名保留，但 Agent 真实执行统一写成 `simulateActivityReadiness`。
- 8.2 新增最小业务工具：`checkDataFreshness`、`diagnoseSkuHealth`、`explainDecisionWithEvidence`。
- 8.3 新增最小 `MinimalPiAgentLoopAdapter`，只暴露 3 个低风险业务工具：
  - `parseActivityRules`
  - `simulateActivityReadiness`
  - `explainDecisionWithEvidence`
- 8.4 `createReviewItems` 在 Agent policy 中升级为 `L2 + REVIEW_GATE`，先开 Gate，不直接写 Review item。
- 8.5 Review Gate 批准后创建 continuation run，并通过 event replay 验证原 run / continuation run 的事件链。
- 8.6 已输出真实 HTTP smoke 日志和截图。

## 工具名与 policy

- 业务工具 registry 现包含：
  - `getSkuSummary`
  - `parseActivityRules`
  - `simulateActivityReadiness`
  - `runSimulation`（兼容别名）
  - `checkDataFreshness`
  - `diagnoseSkuHealth`
  - `createReviewItems`
  - `explainDecisionWithEvidence`
  - `generateReportPreview`
- Pi adapter 只公开 3 个低风险工具：`parseActivityRules`、`simulateActivityReadiness`、`explainDecisionWithEvidence`。
- `createReviewItems` 不在 Pi 可见工具列表中；即使 run 尝试调用，也会被 `AgentToolPolicy` 转成 `REVIEW_REQUIRED` 并创建 `AgentReviewGate`。
- `coding`、`file`、`bash`、`sql`、`cookie/token/jwt/sso/secret` 相关工具名继续 fail-closed 拒绝。

## Review Gate / continuation / replay

- 原始 run 在尝试 `createReviewItems` 后会追加：
  - `run.status_changed`：`WAITING_REVIEW`
  - `review_gate.opened`
  - `tool.call_recorded`：`REVIEW_REQUIRED`
- Review Gate 决策接口：
  - `POST /api/agent/review-gates/:gateId/decision`
- 批准后会追加：
  - 原 run：`review_gate.decided`
  - continuation run：`run.continuation_started`
- replay 接口：
  - `GET /api/agent/runs/:runId/events?after=0`

## 验证命令

- OpenSpec
  - `openspec validate final-pi-tool-policy-poc --strict`
- backend
  - `npx --yes tsx --test apps/backend/tests/unit/backendBusinessFoundation.test.ts apps/backend/tests/unit/finalAgentEventStoreFoundation.test.ts apps/backend/tests/integration/crossModuleAcceptanceSmoke.test.ts`
- frontend
  - `pnpm install --frozen-lockfile`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`
- HTTP smoke
  - `pnpm start -p 3100`
  - `curl -X POST http://localhost:3100/api/agent/pi/smoke`
  - `curl -X POST http://localhost:3100/api/agent/review-gates/:gateId/decision`
  - `curl http://localhost:3100/api/agent/runs/:runId/events?after=0`

## 验证结果

- `openspec validate final-pi-tool-policy-poc --strict`：通过。
- backend 3 个测试文件共 9 项：通过。
- `pnpm typecheck`：通过。
- `pnpm lint`：通过。
- `pnpm build`：通过。
- HTTP smoke：通过，已验证 `tool call -> policy -> Review Gate -> continuation run -> event replay`。

## 证据路径

- 日志：
  - `output/final-pi-tool-policy-poc/pi-smoke-response.json`
  - `output/final-pi-tool-policy-poc/pi-review-decision.json`
  - `output/final-pi-tool-policy-poc/pi-run-events.json`
  - `output/final-pi-tool-policy-poc/pi-continuation-events.json`
- 截图：
  - `output/final-pi-tool-policy-poc/pi-evidence.png`
- 辅助页面：
  - `output/final-pi-tool-policy-poc/pi-evidence.html`

## 风险

- 非阻塞：`runSimulation` 仍保留兼容入口；后续若做全量清理，需要同步更新依赖旧名字的调用方和文档。
- 非阻塞：本次 smoke 使用 `localhost:3100`。当前机器上的 `127.0.0.1:3100` 指向其他 Express 服务，不能混用。
- 非阻塞：`checkDataFreshness`、`diagnoseSkuHealth` 当前是最小实现，后续若接入更严格 SLA/多快照策略，需要补更细粒度规则。

## 结论

- 当前 change 可声明：已完成，不阻塞 Layer 4C/4D/P0。
