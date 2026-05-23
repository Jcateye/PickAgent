## Why

P0 生产路径需要最小 API 鉴权、tenant/session 边界和 runtime config。Pi adapter 生产路径必须 fail-closed，只暴露低风险业务工具，禁止 coding/file/bash/sql/credential 等能力。

## What Changes

- 冻结生产 API auth boundary、tenant/session context、request audit requirement。
- 冻结 Pi runtime adapter allowlist / denylist / config requirement。
- 要求所有 Agent route 和业务 route 在生产模式下拒绝缺失边界的请求。

## Capabilities

### New Capabilities
- `p0-auth-boundary-and-runtime-config`: Production APIs MUST enforce minimal auth, tenant, and session boundaries, and Pi runtime config SHALL expose only approved low-risk business tools.

## Impact

- Affected systems: API middleware, route guards, tenant/session context, AgentToolPolicy, Pi adapter config
- Dependencies: L4 route contract; can develop in parallel with persistence after boundary contract is frozen
- Parallel rule: 与 EventStore persistence 可并行，但 production smoke 必须等待本 change 合并。
