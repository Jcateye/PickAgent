# final-agent-eventstore-foundation 交接文档

## 完成范围

- 完成 `AgentEventStore.append/listAfter/markRunStatus/linkWorkflowStep` 接口与 in-memory 实现。
- 完成 `AgentRepository` 对 `AgentSession`、`AgentMission`、`AgentRun`、`AgentRunEvent`、`AgentToolCall`、`AgentReviewGate` 的最小访问。
- 完成 `AgentToolExecutor` 与 `AgentToolPolicy`，工具调用统一返回 `permission`、`riskLevel`、`reviewPolicy`、`evidenceRefs`。
- 完成 Review Gate decision 默认创建 continuation run，并记录原 run 的 gate decision event 与新 run 的 continuation started event。

## Route

- `POST /api/agent/missions`
  - 入参：`sessionKey`、`objective` 必填；可选 `missionType`、`autonomyLevel`、`sourceSurface`、`subjectType`、`subjectId`、`constraintsJson`、`workbenchContextJson`、`createdBy`。
  - 出参：`{ session, mission }`。
- `POST /api/agent/missions/:missionId/runs`
  - 入参：可选 `modelProvider`、`modelName`、`inputJson`、`timeoutMs`。
  - 出参：`AgentRun`，并已 append `run.started` 事件。
- `GET /api/agent/runs/:runId/events?after=<sequence>`
  - 出参：`{ items, after }`，`items` 按 `sequence` 升序返回缺失事件。
- `POST /api/agent/review-gates/:gateId/decision`
  - 入参：`decision`、`decidedBy` 必填；可选 `decisionComment`。
  - 出参：`{ gate, continuationRun, event }`。

## Policy

- 允许的最小注册工具：`sku_health_summary`、`activity_simulation_preview`、`report_preview`。
- 未注册工具默认 `DENY / L3 / DENY`，并写入 `AgentToolCall`。
- 显式拒绝高危工具和凭证访问：`coding`、`file`、`bash`、`direct SQL`、`credential access`、cookie、token、JWT、SSO、secret、api key。
- 当前实现不保存或复制 Cookie、token、JWT、SSO 标识或模型密钥。
- 当前 Pi adapter 边界仍为 EventStore / ToolExecutor / Policy；本 change 未引入 Prisma 直连或业务 service 直连。

## 验证

- `./scripts/typecheck backend`：通过。
- `./scripts/typecheck frontend`：通过。验证前已按 `apps/frontend/pnpm-lock.yaml` 执行 `pnpm --dir apps/frontend install --frozen-lockfile` 安装本地依赖。
- `npx --yes -p tsx tsx --test apps/backend/tests/unit/finalAgentEventStoreFoundation.test.ts apps/backend/tests/unit/finalApiPersistenceFoundation.test.ts`：通过，6 个测试全部 pass。

## 下游解锁项

- Layer 4B/4C 可以基于 `AgentEventStore.listAfter` 做 SSE replay。
- Agent runtime 可以只通过 `AgentToolExecutor.execute` 接工具能力，不需要直接访问 Prisma 或业务 service。
- PostgreSQL/Prisma adapter 后续可替换 `AgentEventStoreState` 与 `AgentRepository`，保持 application contract 不变。

## 风险

- 当前 repository 是 in-memory foundation，不声明为生产默认持久化路径。
- Next route 未启动 dev server 做 HTTP smoke；服务层覆盖了 append-before-replay、replay、tool policy、review gate continuation、危险工具拒绝，frontend typecheck 覆盖 route 编译。
- 可声明不阻塞 Layer 4B/4C；真正生产化仍需后续 persistence adapter 和 SSE route 接入。
