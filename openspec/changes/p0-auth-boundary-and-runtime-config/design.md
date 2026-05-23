## Context

本子 change 只做生产最小边界，不建设完整权限系统。MVP 非目标仍成立：不做真实 ERP 深度集成，不引入复杂 IAM，不自动越权执行。

## Requirements Boundary

- API request 必须带有可审计 actor、tenant、session 或等价最小上下文。
- route guard 必须在生产模式 fail-closed。
- repository query/write 必须接受 tenant/session boundary，避免跨租户读写。
- Agent session、mission、run 必须记录 actor / tenant / surface。
- Pi production adapter 只暴露 `parseActivityRules`、`simulateActivityReadiness`、`explainDecisionWithEvidence` 或经本 change 审批的低风险业务工具。
- denylist 必须覆盖 coding、file、bash、sql、credential、cookie、token、JWT、SSO、secret、api key。

## Forbidden Scope

- 不做完整 RBAC/ABAC 管理后台。
- 不保存敏感 credential。
- 不允许生产环境自动回退到无鉴权 dev mode。
- 不让环境变量缺失时默认开启高风险工具。

## Verification

- `openspec validate p0-auth-boundary-and-runtime-config --strict`
- route guard 单测覆盖缺失 auth、跨 tenant、缺失 session。
- ToolPolicy 单测覆盖 allowlist 和 denylist。
- production config smoke 证明危险工具不可见且不可执行。
