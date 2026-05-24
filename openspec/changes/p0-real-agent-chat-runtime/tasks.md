## Tasks

- [x] 1.1 冻结真实 Agent chat runtime OpenSpec requirement 和验收标准。
- [x] 1.2 实现 `RealAgentChatRuntime`、`AgentConversationRepository`、`AgentModelAdapter` contract。
- [x] 1.3 将 `/api/agent/chat` 切到真实模式 fail-closed 入口，移除生产默认 seed/template 回复。
- [x] 1.4 补缺配置失败测试和 model adapter 成功路径测试。
- [x] 1.5 运行 OpenSpec、typecheck、测试，并提交中文 commit。
- [x] 2.1 冻结 Prisma conversation repository seam requirement 和验收标准。
- [x] 2.2 实现 `PrismaAgentConversationRepository` 和 required delegate 检查。
- [x] 2.3 将 `/api/agent/chat` 的真实 repository 配置边界接入 fail-closed 检查。
- [x] 2.4 补 Prisma delegate 写入顺序测试和缺 delegate route 测试。
- [x] 2.5 运行 OpenSpec、typecheck、测试，并提交中文 commit。
