# Pi Agent Copilot 可实现设计文档

版本：v0.1  
日期：2026-05-23  
状态：设计稿  
风险等级：设计阶段 L2；实际引入 Pi runtime 依赖前需要 ADR 确认  
适用范围：`apps/frontend`、`apps/backend`、`apps/contracts`
后端数据结构专项设计：`docs/agent-backend-data-architecture.md`
Layer 3 到最终设计收敛：`docs/final-design-gap-closure.md`

## 1. 设计目标

把 SKU Ready Agent 从“业务系统 + Chat 页面”升级为“双工作台 + Agent Copilot”：

```text
人工工作台：
运营、商品、供应链、法务人员按页面操作 Dashboard、SKU、Activities、Review、Reports。

Agent 工作台：
Agent 接收目标，读取当前工作台上下文，规划执行路径，调用业务原子工具，展示长任务状态、工具痕迹、证据和人工接管点。
```

Pi 的定位不是业务系统，也不是直接替代现有 service，而是 Agent Loop Runtime：

```text
Pi 负责：session、context assembly、model loop、tool execution、stream events、timeout、run lifecycle。
Vercel AI SDK 负责：LLM provider 接入、模型调用参数、tool schema / streaming 适配。
assistant-ui 负责：会话 UI、消息流、输入框、工具状态展示组件承载。
业务系统负责：Rule DSL、规则引擎、Evidence、Review Gate、权限边界、确定性业务工具。
```

更具体地说，Agent 工作台采用三层分工：

```text
Pi = Agent harness / loop runtime
Vercel AI SDK = LLM integration layer
assistant-ui = conversation UI layer
```

Pi 不直接替代 Vercel AI SDK 和 assistant-ui。Pi 负责“任务如何跑起来、如何持续、如何调工具、如何产生运行事件”；Vercel AI SDK 负责“模型怎么接、工具 schema 怎么给模型、流式输出如何适配”；assistant-ui 负责“用户如何在工作台里和 Agent 对话、看消息、看工具状态”。

## 2. 非目标

- 不让 Pi 直接读写数据库。
- 不暴露 Pi 默认 coding / file / bash 工具给业务 Agent。
- 不让 Agent 自动改价、自动报名、自动修改商品详情页。
- 不把业务判断写进前端 Chat。
- 不用 Agent 输出替代 Rule DSL、规则引擎和人工 Review。
- P0 不做复杂多 Agent mesh，只做一个 SKU Ready Copilot。

## 3. 总体架构

```text
Frontend
├── 人工工作台页面
│   ├── Dashboard
│   ├── SKU Health
│   ├── Activities
│   ├── Review
│   └── Reports
└── Agent Copilot Overlay
    ├── Floating Bubble
    ├── Sidecar Panel
    └── Compare Mode

Backend
├── AgentMissionController
├── AgentRunController
├── AgentContextController
├── AgentMissionService
├── PiAgentLoopAdapter          # Agent harness / loop runtime
├── VercelAiModelAdapter        # LLM provider / tool schema / stream adapter
├── AgentContextAssembler
├── AgentToolRegistry
├── ReviewGatePolicy
└── Existing Business Services
    ├── ActivityRuleService
    ├── ActivitySimulationService
    ├── HealthAssessmentService
    ├── ReviewService
    ├── ReportService
    ├── SkuQueryService
    └── IngestService
```

核心调用链：

```text
用户在任意工作台页面打开 Agent Copilot
    ↓
Agent Copilot 收集当前页面上下文
    ↓
POST /api/agent/missions
    ↓
AgentMissionService 创建 Mission
    ↓
PiAgentLoopAdapter 启动 Pi session / run
    ↓
VercelAiModelAdapter 负责模型调用与 tool schema 适配
    ↓
Pi 通过 AgentToolRegistry 调业务原子工具
    ↓
业务 service 产出 DTO / Evidence / ReviewItem / WorkflowStep
    ↓
SSE 推送 assistant delta、tool event、review gate、context link
    ↓
Agent Copilot UI 与左侧工作台内容对照展示
```

## 4. 核心状态模型

状态需要拆开，避免一个 `status` 同时表达业务任务、Pi loop、工具调用和人工审批。

```ts
type MissionStatus =
  | "DRAFT"
  | "PLANNING"
  | "RUNNING"
  | "WAITING_FOR_DATA"
  | "WAITING_FOR_REVIEW"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

type PiRunStatus =
  | "IDLE"
  | "QUEUED"
  | "PREPARING_CONTEXT"
  | "RUNNING"
  | "STREAMING"
  | "CALLING_TOOL"
  | "PAUSED"
  | "TIMEOUT"
  | "FAILED"
  | "DONE";

type ToolCallStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "BLOCKED_BY_POLICY"
  | "WAITING_FOR_APPROVAL";

type ReviewGateStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "MODIFIED";
```

状态映射：

| 场景 | MissionStatus | PiRunStatus | ToolCallStatus | ReviewGateStatus |
|---|---|---|---|---|
| 用户刚输入目标 | DRAFT | IDLE | PENDING | NOT_REQUIRED |
| Agent 正在生成计划 | PLANNING | PREPARING_CONTEXT | PENDING | NOT_REQUIRED |
| Agent 正在执行工具 | RUNNING | CALLING_TOOL | RUNNING | NOT_REQUIRED |
| 数据过期，需要插件采集 | WAITING_FOR_DATA | PAUSED | WAITING_FOR_APPROVAL | PENDING |
| 规则歧义，需要人工确认 | WAITING_FOR_REVIEW | PAUSED | WAITING_FOR_APPROVAL | PENDING |
| Review 批准后继续 | RUNNING | RUNNING | RUNNING | APPROVED |
| 全部完成 | COMPLETED | DONE | SUCCEEDED | APPROVED / NOT_REQUIRED |

## 5. Agent Copilot UI 设计

Agent 不做单独页面优先，而是作为所有人工工作台页面上的常驻 Overlay。

### 5.1 三种 UI 形态

```text
Floating Bubble：
默认收起，显示 Agent 当前状态、未读事件、Review 数量。

Sidecar Panel：
展开到右侧，显示 Chat、Plan、Trace、Context、Review Gate。

Compare Mode：
固定在右侧，和当前页面选中的 SKU / 规则 / Review / 报告做对照。
```

### 5.2 Floating Bubble 状态

| 状态 | 展示 |
|---|---|
| Idle | 灰色圆点 |
| Planning | 小进度环 + “Planning” |
| Running | 进度环 + 当前 step |
| Calling Tool | 当前 tool 名 |
| Waiting Review | 黄色标记 + Review 数 |
| Failed | 红色标记 |
| Completed | 绿色标记 |

### 5.3 Sidecar Panel 信息架构

```text
Agent Copilot
├── Chat
│   ├── 对话流
│   ├── Mission 输入框
│   └── Agent 回复与下一步建议
├── Plan
│   ├── Mission 目标
│   ├── Agent Plan
│   ├── 当前 step
│   └── Next Best Actions
├── Trace
│   ├── Pi lifecycle events
│   ├── tool start/update/end
│   ├── tool input/output 摘要
│   └── linked evidence
├── Context
│   ├── 当前页面
│   ├── 当前选中对象
│   ├── Agent 可见上下文
│   └── 证据与数据质量
└── Review Gate
    ├── 待确认问题
    ├── Agent 建议
    ├── 风险说明
    └── Approve / Reject / Modify
```

### 5.4 工作台与 Chat 对照

页面需要提供 `WorkbenchContext` 给 Copilot：

```ts
interface WorkbenchContext {
  route: string;
  pageTitle: string;
  selectedEntity?: {
    entityType: "sku" | "activityRuleSet" | "simulationRun" | "simulationResult" | "reviewItem" | "report";
    entityId: string;
    label: string;
  };
  visibleFilters: Record<string, unknown>;
  visibleColumns?: string[];
}
```

对照规则：

- 用户选中 SKU，Agent Context 自动切到该 SKU 的健康诊断、最新快照、模拟结果和 Evidence。
- 用户选中规则，Agent 可以解释该规则需要哪些字段、影响哪些 SKU、哪些数据缺失。
- 用户选中 Review，Agent 展示该 Review 的问题、建议、风险和证据链。
- Agent 回答时返回 `linkedEntityRefs`，前端可高亮左侧表格行或打开详情抽屉。

## 6. Pi Agent Loop Adapter

Pi 必须被包在 Adapter 后面，业务层不直接依赖 Pi 类型。

```ts
interface AgentLoopAdapter {
  startRun(input: StartAgentRunInput): Promise<AgentRunAccepted>;
  streamRunEvents(runId: string): AsyncIterable<AgentRunEvent>;
  sendUserMessage(runId: string, message: AgentUserMessage): Promise<void>;
  approveGate(runId: string, gateId: string, decision: ReviewGateDecision): Promise<void>;
  cancelRun(runId: string): Promise<void>;
}
```

`PiAgentLoopAdapter` 职责：

- 创建 / 恢复 Pi session。
- 注入 system prompt、业务上下文摘要、工具清单。
- 将 Pi 的 assistant / tool / lifecycle events 映射为统一 `AgentRunEvent`。
- 在工具调用前执行 `ReviewGatePolicy`。
- 将工具结果持久化到 `WorkflowStep.outputJson`。
- 将 Pi session id、run id 与 `WorkflowRun` 绑定。

## 7. 事件流设计

优先使用 SSE，后续需要双向实时控制时再升级 WebSocket。

```ts
type AgentRunEvent =
  | {
      type: "lifecycle";
      runId: string;
      phase: "accepted" | "context_ready" | "start" | "end" | "error" | "timeout";
      timestamp: string;
      payload?: Record<string, unknown>;
    }
  | {
      type: "assistant_delta";
      runId: string;
      messageId: string;
      textDelta: string;
      timestamp: string;
    }
  | {
      type: "tool";
      runId: string;
      toolCallId: string;
      toolName: AgentToolName;
      phase: "start" | "update" | "end" | "error" | "blocked";
      payload: Record<string, unknown>;
      evidenceRefs?: EvidenceRef[];
      timestamp: string;
    }
  | {
      type: "review_gate";
      runId: string;
      gateId: string;
      status: ReviewGateStatus;
      reviewItemId?: string;
      question: string;
      recommendation?: string;
      timestamp: string;
    }
  | {
      type: "context_link";
      runId: string;
      linkedEntityRefs: LinkedEntityRef[];
      timestamp: string;
    };
```

前端消费规则：

- `assistant_delta` 写入 Chat。
- `tool` 写入 Trace。
- `review_gate` 打开 Review Gate 区域并暂停 Mission。
- `context_link` 高亮工作台对象。
- `lifecycle` 更新气泡状态和 Mission progress。

## 8. Agent Tool Registry

Agent 只能调用注册过的业务原子工具。

```ts
interface AgentToolDefinition {
  name: AgentToolName;
  label: string;
  description: string;
  inputSchemaName: string;
  outputSchemaName: string;
  service: string;
  method: string;
  permission: "read" | "simulate" | "create_review" | "generate_report";
  riskLevel: "L0" | "L1" | "L2";
  reviewPolicy: "none" | "required_before_execute" | "required_after_suggestion";
  evidencePolicy: "required" | "optional";
}
```

P0 工具清单：

| Tool | Service | 权限 | 风险 | Review |
|---|---|---|---|---|
| `parseActivityRules` | ActivityRuleService | simulate | L1 | none |
| `extractExecutionRequirements` | ExecutionPathPlanner | read | L1 | none |
| `checkDataFreshness` | SkuQueryService | read | L0 | none |
| `requestConnectorIngest` | IngestService | simulate | L1 | required_after_suggestion |
| `diagnoseSkuHealth` | HealthAssessmentService | simulate | L1 | none |
| `simulateActivityReadiness` | ActivitySimulationService | simulate | L1 | none |
| `generateExecutionChecklist` | ExecutionPathPlanner | read | L1 | none |
| `createReviewItems` | ReviewService | create_review | L2 | required_before_execute |
| `generateActivityReport` | ReportService | generate_report | L1 | none |
| `explainDecisionWithEvidence` | ReportService / EvidenceBuilder | read | L0 | none |

禁止工具：

- shell / bash
- file write
- browser automation that changes production data
- credential / token access
- direct SQL
- direct Prisma client access

## 9. Context Assembly

Agent 可见上下文分四层：

```text
1. Stable System Context
产品边界、工具说明、安全规则、Review Gate 规则。

2. Mission Context
用户目标、活动规则、约束、deadline、autonomy level。

3. Workbench Context
当前页面、选中对象、筛选条件、用户正在看的表格或详情。

4. Business Evidence Context
RuleSet、CurrentSkuProjection、SkuSnapshot 摘要、SimulationRun、ReviewItem、EvidenceRef。
```

实现原则：

- 默认给摘要，不直接塞完整 rawJson。
- Agent 需要细节时调用 `explainDecisionWithEvidence` 或专用查询工具。
- Evidence 必须带 `sourceType`、`sourceId`、`field`、`rawValue`、`normalizedValue`、`ruleId`、`collectedAt`。
- Context 超长时做摘要与分段，不能让模型上下文成为唯一状态源。

## 10. Review Gate 与安全策略

触发 Review Gate 的条件：

- 规则解析置信度低。
- 规则口径歧义。
- 数据过期。
- 多源数据冲突。
- 缺少关键字段。
- L2 风险工具即将创建 ReviewItem、触发连接器采集、生成对外报告。
- Agent 建议涉及改价、报名、库存、证书、法务确认等动作。

Gate 输出：

```ts
interface ReviewGate {
  gateId: string;
  runId: string;
  toolCallId?: string;
  reasonCode: string;
  question: string;
  agentRecommendation?: string;
  riskIfApproved?: string;
  riskIfRejected?: string;
  evidenceRefs: EvidenceRef[];
  status: ReviewGateStatus;
}
```

安全策略：

- Tool call 前做 allowlist 校验。
- Tool result 做大小限制与敏感字段过滤。
- 连续失败或无进展工具调用触发 loop guard。
- 长任务有 timeout。
- 所有 tool call、review gate、人工决策写入 `WorkflowStep` / `ReviewItem`。
- Agent 回复必须能链接到 evidence、rule、run、tool trace 或 review gate。

## 11. 数据落位

P0 复用现有模型：

- `WorkflowRun`：记录 Agent Mission run。
- `WorkflowStep`：记录 Pi lifecycle step、tool call、gate 等执行步骤。
- `ReviewItem`：记录人工确认项。
- `ActivityRuleSet` / `ActivitySimulationRun` / `ActivitySimulationResult`：记录规则与模拟。

P1 视情况新增：

```text
AgentSession
AgentMission
AgentMessage
AgentToolCall
AgentContextLink
```

是否新增取决于 Pi session 与业务审计是否需要长期独立查询。P0 可以先把 session metadata 放入 `WorkflowRun.inputJson/outputJson`。

## 12. API 草案

```text
POST /api/agent/missions
创建 Mission，返回 missionId。

POST /api/agent/runs
启动或恢复 Agent run，返回 runId、acceptedAt。

GET /api/agent/runs/:runId/events
SSE 事件流。

POST /api/agent/runs/:runId/messages
向已有 run 发送用户消息。

POST /api/agent/runs/:runId/cancel
取消 run。

POST /api/agent/runs/:runId/review-gates/:gateId/decision
提交人工确认。

GET /api/agent/context
根据当前 workbench context 返回 Agent 可见上下文摘要。
```

## 13. 前端模块建议

```text
apps/frontend/src/modules/agent-copilot/
├── agent-copilot-provider.tsx
├── floating-bubble.tsx
├── sidecar-panel.tsx
├── tabs/
│   ├── chat-tab.tsx
│   ├── plan-tab.tsx
│   ├── trace-tab.tsx
│   ├── context-tab.tsx
│   └── review-gate-tab.tsx
├── hooks/
│   ├── use-agent-run-events.ts
│   ├── use-workbench-context.ts
│   └── use-context-links.ts
└── types.ts
```

工作台页面接入方式：

```ts
registerWorkbenchContext({
  route: "/activities",
  pageTitle: "活动规则与准入模拟",
  selectedEntity: {
    entityType: "activityRuleSet",
    entityId: "rule_set_618",
    label: "天猫618黄金类目规则",
  },
  visibleFilters: {
    category: "黄金",
    platform: "tmall",
  },
});
```

## 14. 后端模块建议

```text
apps/backend/src/agent/
├── api/
│   ├── AgentMissionController.ts
│   ├── AgentRunController.ts
│   └── AgentContextController.ts
├── application/
│   ├── AgentMissionService.ts
│   ├── AgentRunService.ts
│   └── AgentContextAssembler.ts
├── runtime/
│   ├── AgentLoopAdapter.ts
│   ├── PiAgentLoopAdapter.ts
│   └── AgentRunEventMapper.ts
├── tools/
│   ├── AgentToolRegistry.ts
│   ├── activity-tools.ts
│   ├── sku-tools.ts
│   ├── review-tools.ts
│   └── report-tools.ts
└── safety/
    ├── ReviewGatePolicy.ts
    ├── ToolPolicy.ts
    └── LoopGuard.ts
```

## 15. 分阶段实现

当前 Layer 3 已经达到“模块级可演示集成”：有单独 Agent 工作台页面、fake runtime adapter、`AgentToolRegistry` 边界和 Review Gate 展示。后续阶段不应继续扩张 fake 页面能力，而应按 `docs/final-design-gap-closure.md` 收敛为 Console Overlay、SSE 事件流、真实 route 和最小 Pi adapter。

### 当前到最终的关键收敛点

| 设计目标 | 当前状态 | 下一步 |
|---|---|---|
| 常驻 Copilot Overlay | 仍是 `/agent-chat` 单页 | 抽出 `agent-copilot` 模块并挂到 console layout |
| WorkbenchContext | 只有展示型 linked context | 每个工作台页面注册 route、selectedEntity、filters |
| SSE event stream | fake run 一次性返回整包 | `AgentRunEvent` 落库后通过 SSE 推送和重放 |
| Pi adapter | fake adapter 正确但非生产 runtime | 接最小 Pi POC，并保留 Vercel AI SDK tool schema 层 |
| Tool Registry | 5 个工具，缺 policy 字段 | 补齐 permission、riskLevel、reviewPolicy、evidencePolicy |
| Review Gate | UI 可决策，未落库恢复，批准后缺少可点击追溯入口 | 通过 `AgentReviewGate`、`ReviewItem`、`TraceableRef` 和 continuation run 承接 |

Layer 4 可以继续用 fake adapter 证明 contract，但最终 P0 不能把 fake adapter 当生产路径。

### Phase 0：设计与可点击 Demo

- 写清 Agent Copilot 设计。
- 做 Floating Bubble / Sidecar Panel 静态 UI。
- 展示 Mission、Plan、Trace、Context、Review Gate 假数据。
- 不接 Pi。

验收：

- 任意工作台页面能打开 Copilot。
- 能展示当前页面上下文和一条示例 Mission。
- 能展示 tool trace 与 review gate。

### Phase 1：Pi 最小 POC

- 引入 Pi 依赖和 `PiAgentLoopAdapter`，将 Pi 作为 Agent harness / loop runtime。
- 保留 Vercel AI SDK 作为 LLM provider / tool schema / streaming 适配层。
- 保留 assistant-ui 作为 Agent Copilot 的会话 UI 层。
- 只开放 3 个工具：
  - `parseActivityRules`
  - `simulateActivityReadiness`
  - `explainDecisionWithEvidence`
- 使用 SSE 展示 assistant delta 和 tool events。
- `WorkflowRun` 记录 run。

验收：

- 用户输入目标后，Pi 能调用工具并返回 trace。
- 工具结果能展示在侧边栏。
- 不暴露 shell / file / bash。

### Phase 2：Context Link 与 Review Gate

- 接入 `WorkbenchContext`。
- Agent 能基于当前 SKU / 规则 / Review 回答。
- Agent 触发 Review Gate 时暂停。
- 人工确认后继续执行。
- Gate 决策结果必须返回可点击的 ReviewItem、AgentReviewGate、AgentRun / ToolCall trace 链接。
- 刷新页面后必须能从服务端恢复 Gate 状态和最近决策，不能只依赖前端内存。

验收：

- 选中 G003 后问“为什么不能报名”，Agent 能引用库存字段和规则。
- 规则歧义时生成 Review Gate。
- Approve 后 Agent 继续生成检查清单。
- Approve 后能打开对应 Review / Gate / Run Trace。

### Phase 3：长任务与恢复

- 支持 run cancel / resume。
- 支持 timeout。
- 支持 loop guard。
- 支持 session compaction / history。
- 可选定时巡检或外部事件触发。

验收：

- 刷新页面后仍能恢复 run 状态。
- 工具连续失败时自动暂停并提示。
- 历史 Mission 可回看。

## 16. 评审口径

对外表达：

> 我们不是把 Chat 放在业务系统旁边，而是把 Chat 升级成 Agent Copilot。人工工作台负责看、改、批；Agent 工作台负责理解目标、规划执行路径、调用原子工具、解释证据、推进长任务，并在风险点交给人确认。Pi 提供底层 agent loop，业务系统提供确定性工具和安全边界。

## 17. 参考

- OpenClaw Agent Loop：`https://docs.openclaw.ai/concepts/agent-loop`
- OpenClaw Pi integration architecture：`https://github.com/openclaw/openclaw/blob/main/docs/pi.md`
