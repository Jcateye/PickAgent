# ADR：Agent Copilot 升级为目标驱动主入口

日期：2026-05-23

## 背景

C 题强调活动规则解析、执行检查清单、决策流程、不确定性处理和人机协同。现有 SKU Ready Agent 的人工工作台可以覆盖员工按页面操作的流程，但如果 Agent 只作为薄问答入口，产品观感会更像业务系统而不是执行辅助 Agent。

## 决策

将 Agent Copilot 升级为与人工工作台并列的目标驱动入口：

- 用户可以用自然语言给出活动目标或规则文本。
- Agent 将目标转为 Mission，展示目标、约束、自治等级和当前状态。
- Agent 生成可见计划，并把每一步映射到系统原生 tool。
- Agent 可以启动长任务，并用 `WorkflowRun` / `WorkflowStep` 承接执行状态。
- 数据过期、规则歧义、多源冲突、高风险动作必须进入 Review Gate。

人工工作台仍保留原有职责，适合员工按 Dashboard、SKU、Activities、Review、Reports 页面逐步操作。Agent Copilot 不复制业务逻辑，只通过 Tool Registry 编排和展示服务端已有能力。

Agent 工作台采用三层分工：

```text
Pi：负责 agent harness / loop runtime。
Vercel AI SDK：负责 LLM provider、tool schema 与 streaming 适配。
assistant-ui：负责会话 UI、消息流、输入区和工具状态展示。
```

Pi 不直接访问业务数据库，不暴露默认 coding/file/bash 工具。业务能力必须通过 `AgentToolRegistry` 注册，所有高风险动作仍走 Review Gate。

## 影响

- 前端主形态是双工作台：人工工作台 + Agent Copilot 工作台。
- 架构新增 `AgentMissionService`、`PiAgentLoopAdapter`、`VercelAiModelAdapter`、`AgentToolRegistry`、`ExecutionPathPlanner` 的服务边界。
- PRD 的路演叙事从“商品健康监控平台”调整为“活动规则执行辅助与商品准入 Agent”。
- 当前风险等级为 L2：新增产品入口和编排边界，不引入新后端基础设施或自动越权执行。
