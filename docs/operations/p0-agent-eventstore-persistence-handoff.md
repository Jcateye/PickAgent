# p0-agent-eventstore-persistence 交接

日期：2026-05-24

## 完成范围

- 冻结 Agent tables / repository adapter / EventStore sequence 策略：沿用 `apps/backend/prisma/schema.prisma` 中 `agent_sessions`、`agent_missions`、`agent_runs`、`agent_run_events`、`agent_tool_calls`、`agent_review_gates`、`workflow_runs`、`workflow_steps`、`review_items`；`AgentRunEvent.sequence` 为单 run 内从 1 递增，replay 使用 `after=<sequence>` 且按 sequence 升序返回。
- `FinalAgentEventStoreFoundation` 已补齐 repository port 行为：AgentRun 默认创建或关联 `WorkflowRun`，重要 tool call 创建并回写 `WorkflowStep`，Review Gate 创建并关联正式 `ReviewItem`。
- EventStore / repository 验收测试覆盖 append、listAfter、status、toolCall、reviewGate、adapter restart restore。
- 审计链验收测试覆盖 `AgentRun.workflowRunId -> WorkflowRun`、`AgentToolCall.workflowStepId -> WorkflowStep`。
- Review Gate 验收测试覆盖 `AgentReviewGate.reviewItemId -> ReviewItem`，并验证 decision 后原 run / continuation run replay 事件链。
- Copilot Overlay 恢复验收脚本覆盖真实 EventStore replay/SSE payload shape，验证 `run.started`、`assistant.delta`、`tool.call_recorded` 可从 replay 重建状态，不依赖前端 fake defaults。
- 敏感字段落库前统一清洗：包含 `cookie`、`token`、`JWT`、`SSO`、`secret`、`apiKey`、`authorization`、`password`、`credential` 的 key 会写为 `[REDACTED]`。

## 改动文件

- `apps/backend/src/application/foundation/FinalAgentEventStoreFoundation.ts`
- `apps/backend/tests/integration/p0AgentEventStorePersistence.test.ts`
- `scripts/p0-agent-eventstore-replay-smoke.mjs`
- `openspec/changes/p0-agent-eventstore-persistence/tasks.md`

## 审查清单

- 敏感信息不落库：已在 Agent runtime metadata、event payload、tool input/output、WorkflowRun/WorkflowStep input/output、ReviewItem evidence 中递归清洗敏感 key。
- Pi adapter 不直连 DB/service：`MinimalPiAgentLoopAdapter` 仍只持有 `FinalAgentService` 与 `AgentEventStore`，只暴露 `parseActivityRules`、`simulateActivityReadiness`、`explainDecisionWithEvidence`，没有 Prisma client、repository state 或 business service 字段。
- ToolPolicy 不绕过：工具调用仍统一通过 `AgentToolExecutor.execute`；未注册和高危工具继续 `DENY / L3 / DENY` 并记录 `AgentToolCall`。
- Review Gate 不替代正式人工任务：L2 `createReviewItems` 会先创建 `AgentReviewGate`，同时创建或关联正式 `ReviewItem`。
- SSE replay：route 已按 `after` 调用 `FinalAgentService.listEvents`；测试脚本验证 replay payload 可按 SSE 格式输出。

## 验证结果

- `openspec validate p0-agent-eventstore-persistence --strict`：通过。
- `./scripts/typecheck backend`：通过，Prisma schema valid。
- `npx --yes tsx --test apps/backend/tests/integration/p0AgentEventStorePersistence.test.ts`：通过，5 项。
- `npx --yes tsx --test apps/backend/tests/unit/finalAgentEventStoreFoundation.test.ts apps/backend/tests/integration/p0AgentEventStorePersistence.test.ts`：通过，10 项。
- `node scripts/p0-agent-eventstore-replay-smoke.mjs`：通过，5 项。

## P0 blocker / P1 risk

- P0 blocker：无新增 blocker。
- P1 risk：当前实现仍基于 foundation in-memory state 做 repository contract 与验收预研；生产默认持久化必须等待 `p0-prisma-repository-transaction` 主路径合并后接入 Prisma adapter。
- 是否等待 Prisma merge：是。此 change 可作为接口/验收预研完成，但最终 production merge 应晚于 Prisma repository / transaction 主路径。
