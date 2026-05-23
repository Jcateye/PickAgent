## Why

L4 证明了本地开发态链路，但生产化 P0 需要 build/start 模式 smoke，验证持久化、鉴权边界、EventStore replay、Copilot contract 和 Pi tool policy 在生产启动方式下仍可用。

## What Changes

- 冻结 production acceptance smoke 子 change。
- 要求使用 build/start 模式而不是 dev-only 截图。
- 要求证据归档覆盖 A/B/C/D 主链路、Agent replay、dangerous tool denial 和重启恢复。

## Capabilities

### New Capabilities
- `p0-production-acceptance-smoke`: Production acceptance MUST run build/start mode smoke and SHALL archive evidence for persistence, auth boundary, Agent replay, Copilot contract, Pi tool policy, and cross-module routes.

## Impact

- Affected systems: scripts, acceptance fixtures, HTTP smoke, browser smoke, evidence archive
- Dependencies: all other P0 child changes
- Parallel rule: 最后合并；可先写 stub/plan，但最终 smoke 必须等待 persistence/auth/EventStore 合并。
