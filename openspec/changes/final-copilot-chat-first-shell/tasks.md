## Tasks

- [x] 1.1 新增 chat-first requirement/spec，冻结默认空白、按输入回复、fixture fallback 规则。
- [x] 1.2 新增 `/api/agent/chat` 最小编排接口，按用户意图调用低风险工具并返回 assistant 回复。
- [x] 1.3 将 `/agent-chat` 与 overlay 切到极简 chat shell，默认不渲染 fixture 会话。
- [x] 1.4 扩展只读低风险工具 allowlist，确保 SKU 读取/诊断可由 Copilot 调用。
- [x] 1.5 补类型检查与最小测试，输出中文验证结论。
