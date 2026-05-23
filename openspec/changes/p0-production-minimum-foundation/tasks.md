## Tasks

- [ ] 10.1 冻结 P0 umbrella requirement、依赖顺序、禁止范围和验收口径。
- [ ] 10.2 创建 `p0-prisma-repository-transaction` 子 change，覆盖 Prisma/PostgreSQL repository 与 transaction 主路径。
- [ ] 10.3 创建 `p0-agent-eventstore-persistence` 子 change，覆盖 AgentEventStore 持久化、SSE replay、Workflow/Review 审计链。
- [ ] 10.4 创建 `p0-auth-boundary-and-runtime-config` 子 change，覆盖生产 API 鉴权、tenant/session 边界和 Pi runtime tool allowlist。
- [ ] 10.5 创建 `p0-production-acceptance-smoke` 子 change，覆盖 build/start 模式生产 smoke 和证据归档。
- [ ] 10.6 更新 P0 分工文档与 final execution tracker，并记录 P0 blocker / P1 risk 判定。
- [ ] 10.7 对所有新 change 执行 `openspec validate <change> --strict`。
