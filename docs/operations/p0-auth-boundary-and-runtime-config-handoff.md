# p0-auth-boundary-and-runtime-config 交接

日期：2026-05-24

## 已完成 requirement

- 完成 P0 最小 `actorId / tenantId / sessionId / surface / requestId` auth context DTO。
- 完成 route guard 行为：production 缺少 actor、tenant 或 session 立即 fail-closed；development/test 只有显式 `P0_ALLOW_DEV_AUTH_FALLBACK=true` 才使用 dev fallback。
- repository/service 层读写传入 tenant/session boundary；跨 tenant 读取、模拟、Review 写入会抛出可审计拒绝。
- Pi production adapter 只暴露 `parseActivityRules`、`simulateActivityReadiness`、`explainDecisionWithEvidence`。
- ToolPolicy denylist 覆盖 coding、file、bash、sql、credential、cookie、token、JWT、SSO、secret、api key。
- 工具调用持久化和 event payload 对 credential-like 字段做 redaction。

## 变更点

- `apps/backend/src/application/foundation/P0AuthBoundaryRuntimeConfig.ts`
  - 新增 runtime config、guard、tenant boundary assert、敏感字段 redaction。
- `apps/backend/src/application/foundation/FinalApiPersistenceFoundation.ts`
  - ingest/query/activity/review/report repository 和 service 增加 boundary 传递。
  - store 记录 entity -> tenant 映射，用于过滤列表和拒绝跨租户 detail/write。
- `apps/backend/src/application/foundation/FinalAgentEventStoreFoundation.ts`
  - ToolPolicy 从 P0 runtime config 读取 allowlist/denylist。
  - MinimalPiAgentLoopAdapter 按 production config fail-closed，不允许生产 dev fallback。
  - tool call input/output 和 replay event payload redaction。
- `apps/backend/tests/unit/p0AuthBoundaryRuntimeConfig.test.ts`
  - 覆盖生产缺失边界、开发显式 fallback、生产禁止 fallback。
- `apps/backend/tests/unit/finalApiPersistenceFoundation.test.ts`
  - 覆盖 tenant/session boundary 传递和跨 tenant 拒绝。
- `apps/backend/tests/unit/finalAgentEventStoreFoundation.test.ts`
  - 覆盖 production allowlist/denylist、production Pi adapter smoke、敏感字段不入 event。

## 敏感凭证审查清单

- 不保存真实 credential、cookie、token、JWT、SSO secret、api key。
- tool call `inputJson`、`outputJson` 写入前必须 redaction。
- `tool.call_recorded` event payload 写入前必须 redaction。
- evidence refs 只保留 policy/tool/review/workflow 引用和摘要，不承载原始凭证值。
- 生产 adapter 可见工具不包含 coding/file/bash/sql/credential/cookie/token/JWT/SSO/secret/api key 能力。
- 新增工具进入 production allowlist 前必须同时补 ToolPolicy 单测和 redaction 断言。

## 验证

- `openspec validate p0-auth-boundary-and-runtime-config --strict`
- `npx --yes tsx --test apps/backend/tests/unit/p0AuthBoundaryRuntimeConfig.test.ts apps/backend/tests/unit/finalApiPersistenceFoundation.test.ts apps/backend/tests/unit/finalAgentEventStoreFoundation.test.ts`
- `NODE_ENV=production npx --yes tsx --test apps/backend/tests/unit/finalAgentEventStoreFoundation.test.ts`

## 风险

- P0 blocker：无。
- P1 risk：当前 boundary 在 foundation runtime 里用 in-memory `entity -> tenant` 映射表达；后续 Prisma repository 合并后需要把同一 boundary 口径落到 SQL where / write columns。
- P1 risk：dev fallback 仍保留，但必须显式配置，production 禁止开启。

## 结论

- 本 change 解锁后续 production smoke 中的 auth boundary 和 Pi dangerous tool denial 验收项。
