## Context

`final-pi-tool-policy-poc` 是最终设计收敛分工中的 Layer 4C 工作包。它承接 `docs/final-design-gap-closure.md`、`docs/architecture.md`、`docs/pi-agent-copilot-design.md`、`docs/agent-backend-data-architecture.md` 和 `docs/operations/pickagent-final-design-work-allocation.md` 的边界。

## Dependencies

- Layer 0；等待 EventStore、ToolExecutor、Overlay 基本可用。

## Boundary

- 本 change 只覆盖 `Pi runtime / ToolPolicy`。
- 共享 contract、repository、route、EventStore 或 ToolPolicy 决策必须回流到对应 foundation change。
- 前端、插件、Agent runtime 不得各自重算业务结论；业务真相仍由 application service / persistence 层拥有。

## Forbidden Scope

- 不引入 NestJS、Redis、InsForge 或新的后端/runtime 底座。
- 不实现自动改价、自动报名、自动修改商品详情页。
- 不保存或复制 Cookie、token、JWT、SSO 标识或模型密钥。
- 不把 mock / fake runtime 声明为生产默认路径。
- 不越权修改其他 `final-*` change 的 tasks 状态。

## Verification

- OpenSpec: `openspec validate final-pi-tool-policy-poc --strict`。
- Markdown/grep: 检查 requirement 使用 MUST / SHALL，scenario 使用 WHEN / THEN，tasks 保留分工文档编号。
- 执行层验证由本 change 的 tasks 指定；最终验收必须把命令、截图/录屏或日志路径写回对应验收文档。

## Mock / Fake Fallback

fake adapter 只可作为 contract fallback；Pi POC 必须证明真实 adapter 只看到业务工具。

## Handoff

完成时必须用中文说明已完成的 requirement、验证命令与结果、仍依赖的上游 change、阻塞项和是否可声明“已完成，不阻塞下一层”。
