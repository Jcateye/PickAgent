## Context

本 change 用于纠正 `Agent Copilot` 的默认交互模型。现状已经具备 `WorkbenchContext`、mission/run API、EventStore replay/SSE 和业务工具 registry，但 UI 仍用 fixture 作为默认会话源，导致用户看到的是预设演示，而不是按意图实时响应的对话体验。

## Boundary

- 本 change 只改 Agent Copilot 的对话壳、最小对话编排 API 和读侧低风险工具开放策略。
- 不改活动、Review、报告等业务结论语义。
- 不引入新的模型底座、外部依赖或危险工具。
- 不让前端直接重算业务结论；对话回答必须来自既有 application service 或 AgentToolRegistry 可达能力。

## Requirement Mapping

### Requirement: Chat-first Copilot shell

- `/agent-chat` 与 overlay 默认显示空白欢迎态和输入框，不预填 fixture 消息。
- 用户提交第一条消息后，前端创建 mission/run，并调用最小 chat API 生成 assistant 回复。
- chat API 必须基于用户意图选择已有低风险业务工具或 service 能力，并返回消息、tool trace、evidence 和 gate 信息。
- fixture 只允许在显式开发 fallback 或 API 故障时启用，并必须在 UI 上标明 fallback。

## Implementation Notes

- 前端新增轻量 chat shell，保留 `WorkbenchContext`，但把 plan/trace/gate 降为按回复展开的次级信息。
- 新增 `/api/agent/chat`，在服务端完成：
  - `createMission`
  - `startRun`
  - 基于意图执行低风险工具
  - 生成 assistant 文本回复
  - 记录必要 event
- 将 `getSkuSummary`、`diagnoseSkuHealth`、`checkDataFreshness` 归入默认低风险只读工具 allowlist，避免聊天页只能解释规则却不能分析 SKU。

## Verification

- `openspec validate final-copilot-chat-first-shell --strict`
- `scripts/typecheck agent-workbench`
- 至少一条针对 `/api/agent/chat` 的测试
- 浏览器或页面 smoke，确认默认空白、发消息后再出现 assistant 回复/工具轨迹
