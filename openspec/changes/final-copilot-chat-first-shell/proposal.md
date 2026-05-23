## Why

当前 `Agent Copilot` 默认以 fixture 消息、计划和 Review Gate 开场，交互模型更像验收演示器，而不是用户期望的 ChatGPT 风格对话应用。这会让用户在尚未表达意图前就看到预设结论，破坏真实对话、按需调工具和简洁界面的产品方向。

## What Changes

- 冻结 `Agent Copilot` 的 chat-first 交互需求、验收场景和任务编号。
- 要求 `/agent-chat` 与 overlay 默认空白起手，只有用户发起消息后才生成回复、trace 和工具调用。
- 要求 fixture 只保留开发 fallback，不再作为默认会话内容来源。

## Capabilities

### New Capabilities

- `final-copilot-chat-first-shell`: Agent Copilot MUST 以 chat-first 方式响应用户消息，并 SHALL 在真实用户输入后才创建 mission/run、回复 assistant 消息和触发工具调用。

## Impact

- Affected docs: `openspec/changes/final-copilot-chat-first-shell/`
- Affected systems: `apps/frontend` Agent Copilot UI, `apps/frontend/src/app/api/agent/*`, Agent tool policy defaults
- Dependencies: 复用 `final-copilot-overlay-closure` 的 `WorkbenchContext` 和 `EventStore` contract；复用 `final-agent-eventstore-foundation` 的 mission/run/tool/gate 基座。
