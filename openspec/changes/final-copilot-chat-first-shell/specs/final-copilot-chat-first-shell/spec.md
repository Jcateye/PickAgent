## ADDED Requirements

### Requirement: Chat-first Copilot shell

Agent Copilot MUST 以 ChatGPT 风格的 chat-first 方式承接用户意图，并 SHALL 在真实用户输入发生后才创建 mission/run、回复 assistant 消息和触发工具调用。

#### Scenario: Blank initial state

- **WHEN** 用户首次打开 `/agent-chat` 或工作台 overlay
- **THEN** 界面显示空白欢迎态和输入框，而不是预置 fixture 消息、计划或 Review Gate。

#### Scenario: Respond only after user intent

- **WHEN** 用户发送一条消息
- **THEN** 系统创建 mission/run，基于消息意图生成 assistant 回复，并只在需要时显示 tool trace、evidence 或 Review Gate。

#### Scenario: Read-side SKU analysis

- **WHEN** 用户要求分析当前 SKU 的详细或历史健康信息
- **THEN** Copilot 通过低风险只读工具读取 SKU 摘要、诊断或新鲜度信息，并返回可追溯的 assistant 说明。

#### Scenario: Explicit fallback state

- **WHEN** chat API 不可用且系统只能退回 fixture
- **THEN** 界面明确标记为 fallback，而不是把 fixture 伪装成真实对话结果。
