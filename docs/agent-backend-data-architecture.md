# Agent 后端数据结构与架构设计

版本：v0.1  
日期：2026-05-23  
状态：可实现设计  
关联文档：`docs/pi-agent-copilot-design.md`、`docs/architecture.md`、`docs/engineering-rules.md`

## 1. 设计目标

本设计用于支撑 Pi 接入后的 Agent 工作台：

```text
人工工作台：
人通过 Dashboard / SKU / Activities / Review / Reports 做确定性操作。

Agent 工作台：
Pi Agent Loop 接收目标，读取当前工作台上下文，调用业务原子工具，输出计划、工具痕迹、证据和 Review Gate。
```

运行时分工：

```text
Pi：负责 Agent harness / loop runtime，包括 session、run lifecycle、tool loop、事件流、暂停与恢复。
Vercel AI SDK：负责 LLM provider 集成、模型调用参数、tool schema 与 streaming 适配。
assistant-ui：负责前端会话 UI、输入框、消息流、工具状态和 Copilot 侧边栏组件承载。
业务系统：负责原子工具、规则引擎、Evidence、Review Gate 和持久化。
```

后端要解决 7 件事：

```text
1. 保存 Agent 会话与 Pi session 映射。
2. 保存 Mission、Run、Message、Event、ToolCall。
3. 让 SSE 可以断线重放。
4. 让工作台页面和 Chat 内容可以互相定位。
5. 让工具调用必须经过 Tool Registry 和 Review Gate。
6. 让 Agent 长任务可以暂停、恢复、取消和审计。
7. 复用现有 WorkflowRun / WorkflowStep / ReviewItem / Evidence JSON，不另起一套业务真相。
```

## 2. 设计原则

- Pi 只做 Agent Loop Runtime，不直接读写业务数据库。
- Agent 只能调用 `AgentToolRegistry` 注册过的业务原子工具。
- 工具最终调用现有 application service，不绕过 service / repository 分层。
- `WorkflowRun` / `WorkflowStep` 继续作为全局审计视图；Agent 专属表保存 Copilot 体验需要的细粒度状态。
- Review Gate 是运行时暂停点；正式人工任务仍落到 `ReviewItem`。
- Evidence P0 继续使用结构化 JSON refs；P1 再拆独立 `EvidenceRef` 表。
- 所有可回放 UI 状态必须由数据库事件或 run 状态恢复，不依赖前端内存。

## 3. 数据模型总览

```text
AgentSession
  └── AgentMission
        └── AgentRun
              ├── AgentMessage
              ├── AgentRunEvent
              ├── AgentToolCall
              ├── AgentContextSnapshot
              ├── AgentContextLink
              └── AgentReviewGate

AgentRun
  └── WorkflowRun
        └── WorkflowStep

AgentReviewGate
  └── ReviewItem?

AgentContextLink
  └── SkuProfile / ActivityRuleSet / ActivitySimulationRun / ActivitySimulationResult / ReviewItem / Report DTO
```

P0 建议新增 9 张 Agent 表：

```text
agent_sessions
agent_missions
agent_runs
agent_messages
agent_run_events
agent_tool_calls
agent_context_snapshots
agent_context_links
agent_review_gates
```

若 P0 要进一步压缩，可以先不建 `agent_context_snapshots`，将 context snapshot 放进 `agent_runs.inputJson`。

## 4. 状态枚举

建议新增 Prisma enums：

```prisma
enum AgentSessionStatus {
  ACTIVE
  ARCHIVED
  CANCELED

  @@map("agent_session_status")
}

enum AgentMissionStatus {
  DRAFT
  PLANNING
  RUNNING
  WAITING_FOR_DATA
  WAITING_FOR_REVIEW
  COMPLETED
  FAILED
  CANCELED

  @@map("agent_mission_status")
}

enum AgentRunStatus {
  IDLE
  QUEUED
  PREPARING_CONTEXT
  RUNNING
  STREAMING
  CALLING_TOOL
  PAUSED
  TIMEOUT
  FAILED
  DONE
  CANCELED

  @@map("agent_run_status")
}

enum AgentMessageRole {
  SYSTEM
  USER
  ASSISTANT
  TOOL

  @@map("agent_message_role")
}

enum AgentToolCallStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
  BLOCKED_BY_POLICY
  WAITING_FOR_APPROVAL
  CANCELED

  @@map("agent_tool_call_status")
}

enum AgentReviewGateStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
  MODIFIED
  CANCELED

  @@map("agent_review_gate_status")
}
```

## 5. Prisma 模型草案

### 5.1 AgentSession

用途：保存一个用户或工作台上下文下的长期 Agent 会话，并映射 Pi session。

```prisma
model AgentSession {
  /// 主键。
  id              String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// 前端或渠道侧 session key，例如 userId + workspace。
  sessionKey      String             @unique @map("session_key") @db.VarChar(256)
  /// 当前用户 ID，MVP 可以是字符串占位。
  userId          String?            @map("user_id") @db.VarChar(128)
  /// 来源 surface，例如 console、extension、external_agent。
  surface         String             @default("console") @db.VarChar(64)
  /// Pi 内部 session key。
  piSessionKey    String?            @map("pi_session_key") @db.VarChar(256)
  /// Pi session 文件或持久化引用，不能存敏感 token。
  piSessionRef    String?            @map("pi_session_ref") @db.Text
  /// 会话标题。
  title           String?            @db.VarChar(180)
  /// 会话状态。
  status          AgentSessionStatus @default(ACTIVE)
  /// 会话级配置 JSON。
  configJson      Json               @default("{}") @map("config_json") @db.JsonB
  /// 最近活跃时间。
  lastActiveAt    DateTime?          @map("last_active_at") @db.Timestamptz(6)
  /// 创建时间。
  createdAt       DateTime           @default(now()) @map("created_at") @db.Timestamptz(6)
  /// 更新时间。
  updatedAt       DateTime           @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  missions        AgentMission[]
  runs            AgentRun[]
  messages        AgentMessage[]

  @@index([userId, status], map: "agent_sessions_user_status_idx")
  @@index([piSessionKey], map: "agent_sessions_pi_session_key_idx")
  @@map("agent_sessions")
}
```

### 5.2 AgentMission

用途：保存业务目标。Mission 是业务层任务，不等同于 Pi 单次 run。

```prisma
model AgentMission {
  id                    String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionId             String              @map("session_id") @db.Uuid
  /// 任务类型，例如 ACTIVITY_RULE_EXECUTION。
  missionType           String              @map("mission_type") @db.VarChar(96)
  /// 用户给出的目标。
  objective             String              @db.Text
  /// 自治等级，例如 L2_REVIEW_GATED_AGENT。
  autonomyLevel         String              @default("L2_REVIEW_GATED_AGENT") @map("autonomy_level") @db.VarChar(64)
  status                AgentMissionStatus  @default(DRAFT)
  /// 来源页面或入口。
  sourceSurface         String              @default("agent_copilot") @map("source_surface") @db.VarChar(64)
  /// 业务主体类型，例如 activityRuleSet、skuProfile。
  subjectType           String?             @map("subject_type") @db.VarChar(96)
  /// 业务主体 ID。
  subjectId             String?             @map("subject_id") @db.VarChar(128)
  /// 约束条件，例如 category、platform、deadline。
  constraintsJson       Json                @default("{}") @map("constraints_json") @db.JsonB
  /// 创建 Mission 时的工作台上下文。
  workbenchContextJson  Json                @default("{}") @map("workbench_context_json") @db.JsonB
  /// 当前计划 JSON，便于列表页快速读取。
  planJson              Json                @default("[]") @map("plan_json") @db.JsonB
  /// 当前下一步建议。
  nextActionsJson       Json                @default("[]") @map("next_actions_json") @db.JsonB
  createdBy             String?             @map("created_by") @db.VarChar(128)
  completedAt           DateTime?           @map("completed_at") @db.Timestamptz(6)
  canceledAt            DateTime?           @map("canceled_at") @db.Timestamptz(6)
  createdAt             DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt             DateTime            @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  session               AgentSession        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  runs                  AgentRun[]
  contextLinks          AgentContextLink[]
  reviewGates           AgentReviewGate[]

  @@index([sessionId, status], map: "agent_missions_session_status_idx")
  @@index([subjectType, subjectId], map: "agent_missions_subject_idx")
  @@index([createdBy, createdAt], map: "agent_missions_created_by_idx")
  @@map("agent_missions")
}
```

### 5.3 AgentRun

用途：保存 Pi 单次运行。一个 Mission 可以有多次 run，比如 Review 后继续、失败重试、用户追加消息。

```prisma
model AgentRun {
  id                 String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  missionId          String          @map("mission_id") @db.Uuid
  sessionId          String          @map("session_id") @db.Uuid
  /// Pi 运行 ID。
  piRunId            String?         @unique @map("pi_run_id") @db.VarChar(128)
  /// 关联全局 WorkflowRun。
  workflowRunId      String?         @unique @map("workflow_run_id") @db.Uuid
  status             AgentRunStatus  @default(QUEUED)
  /// 当前模型 provider。
  modelProvider      String?         @map("model_provider") @db.VarChar(64)
  /// 当前模型名。
  modelName          String?         @map("model_name") @db.VarChar(128)
  /// 输入摘要。
  inputJson          Json            @default("{}") @map("input_json") @db.JsonB
  /// 输出摘要。
  outputJson         Json            @default("{}") @map("output_json") @db.JsonB
  /// 错误信息。
  errorMessage       String?         @map("error_message") @db.Text
  /// 超时时间毫秒。
  timeoutMs          Int?            @map("timeout_ms")
  /// 取消请求标记。
  cancelRequested    Boolean         @default(false) @map("cancel_requested")
  /// token / cost / latency 等元数据。
  usageJson          Json            @default("{}") @map("usage_json") @db.JsonB
  metadataJson       Json            @default("{}") @map("metadata_json") @db.JsonB
  startedAt          DateTime?       @map("started_at") @db.Timestamptz(6)
  completedAt        DateTime?       @map("completed_at") @db.Timestamptz(6)
  createdAt          DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime        @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  mission            AgentMission    @relation(fields: [missionId], references: [id], onDelete: Cascade)
  session            AgentSession    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  messages           AgentMessage[]
  events             AgentRunEvent[]
  toolCalls          AgentToolCall[]
  contextSnapshots   AgentContextSnapshot[]
  contextLinks       AgentContextLink[]
  reviewGates        AgentReviewGate[]

  @@index([missionId, createdAt], map: "agent_runs_mission_created_idx")
  @@index([sessionId, status], map: "agent_runs_session_status_idx")
  @@index([status, createdAt], map: "agent_runs_status_created_idx")
  @@map("agent_runs")
}
```

### 5.4 AgentMessage

用途：保存 Chat 消息，支持刷新恢复和 Mission 历史回看。

```prisma
model AgentMessage {
  id            String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionId     String            @map("session_id") @db.Uuid
  runId         String?           @map("run_id") @db.Uuid
  role          AgentMessageRole
  /// 消息序号，按 session 内递增。
  orderIndex    Int               @map("order_index")
  contentText   String?           @map("content_text") @db.Text
  contentJson   Json              @default("{}") @map("content_json") @db.JsonB
  status        String            @default("completed") @db.VarChar(32)
  parentId      String?           @map("parent_id") @db.Uuid
  createdAt     DateTime          @default(now()) @map("created_at") @db.Timestamptz(6)
  session       AgentSession      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  run           AgentRun?         @relation(fields: [runId], references: [id], onDelete: SetNull)

  @@unique([sessionId, orderIndex], map: "agent_messages_session_order_key")
  @@index([runId, createdAt], map: "agent_messages_run_created_idx")
  @@map("agent_messages")
}
```

### 5.5 AgentRunEvent

用途：SSE 断线恢复、Trace 回放、调试审计。所有 Pi lifecycle、assistant delta、tool event、review gate 都写这里。

```prisma
model AgentRunEvent {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  runId       String    @map("run_id") @db.Uuid
  /// run 内严格递增序号。
  sequence    Int
  eventType   String    @map("event_type") @db.VarChar(64)
  eventPhase  String?   @map("event_phase") @db.VarChar(64)
  payloadJson Json      @default("{}") @map("payload_json") @db.JsonB
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  run         AgentRun  @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, sequence], map: "agent_run_events_run_sequence_key")
  @@index([runId, eventType], map: "agent_run_events_run_type_idx")
  @@map("agent_run_events")
}
```

### 5.6 AgentToolCall

用途：保存每个工具调用的输入、输出、状态、Evidence refs 和 Review policy。

```prisma
model AgentToolCall {
  id                 String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  runId              String               @map("run_id") @db.Uuid
  /// Pi 或 SDK 侧 tool call id。
  externalToolCallId String?              @map("external_tool_call_id") @db.VarChar(128)
  /// 关联 WorkflowStep。
  workflowStepId     String?              @map("workflow_step_id") @db.Uuid
  toolName           String               @map("tool_name") @db.VarChar(96)
  status             AgentToolCallStatus  @default(PENDING)
  riskLevel          String               @default("L1") @map("risk_level") @db.VarChar(16)
  reviewPolicy       String               @default("none") @map("review_policy") @db.VarChar(64)
  inputJson          Json                 @default("{}") @map("input_json") @db.JsonB
  outputJson         Json                 @default("{}") @map("output_json") @db.JsonB
  evidenceRefsJson   Json                 @default("[]") @map("evidence_refs_json") @db.JsonB
  errorMessage       String?              @map("error_message") @db.Text
  blockedReason      String?              @map("blocked_reason") @db.Text
  startedAt          DateTime?            @map("started_at") @db.Timestamptz(6)
  completedAt        DateTime?            @map("completed_at") @db.Timestamptz(6)
  createdAt          DateTime             @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  run                AgentRun             @relation(fields: [runId], references: [id], onDelete: Cascade)
  reviewGates        AgentReviewGate[]

  @@unique([runId, externalToolCallId], map: "agent_tool_calls_run_external_key")
  @@index([runId, status], map: "agent_tool_calls_run_status_idx")
  @@index([toolName, status], map: "agent_tool_calls_tool_status_idx")
  @@map("agent_tool_calls")
}
```

注意：PostgreSQL unique 对 nullable 字段允许多个 null。若 `externalToolCallId` 经常为空，应在应用层生成稳定 id。

### 5.7 AgentContextSnapshot

用途：保存一次 run 的上下文快照，便于复盘“Agent 当时看到了什么”。

```prisma
model AgentContextSnapshot {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  runId                 String    @map("run_id") @db.Uuid
  workbenchContextJson  Json      @default("{}") @map("workbench_context_json") @db.JsonB
  stableContextJson     Json      @default("{}") @map("stable_context_json") @db.JsonB
  missionContextJson    Json      @default("{}") @map("mission_context_json") @db.JsonB
  evidenceSummaryJson   Json      @default("{}") @map("evidence_summary_json") @db.JsonB
  tokenEstimate         Int?      @map("token_estimate")
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  run                   AgentRun  @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, createdAt], map: "agent_context_snapshots_run_created_idx")
  @@map("agent_context_snapshots")
}
```

### 5.8 AgentContextLink

用途：把 Chat / Tool / Review 与工作台对象关联，支撑高亮、跳转和对照。

```prisma
model AgentContextLink {
  id              String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  missionId       String?       @map("mission_id") @db.Uuid
  runId           String?       @map("run_id") @db.Uuid
  /// 来源，例如 assistant_message、tool_call、review_gate。
  sourceType      String        @map("source_type") @db.VarChar(64)
  sourceId        String?       @map("source_id") @db.VarChar(128)
  entityType      String        @map("entity_type") @db.VarChar(96)
  entityId        String        @map("entity_id") @db.VarChar(128)
  label           String?       @db.VarChar(180)
  reason          String?       @db.Text
  highlightJson   Json          @default("{}") @map("highlight_json") @db.JsonB
  createdAt       DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  mission         AgentMission? @relation(fields: [missionId], references: [id], onDelete: Cascade)
  run             AgentRun?     @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([missionId, entityType], map: "agent_context_links_mission_entity_idx")
  @@index([runId, entityType], map: "agent_context_links_run_entity_idx")
  @@index([entityType, entityId], map: "agent_context_links_entity_idx")
  @@map("agent_context_links")
}
```

### 5.9 AgentReviewGate

用途：运行时暂停点。它可以创建并关联 `ReviewItem`，但两者职责不同：

```text
AgentReviewGate：Agent run 为什么暂停、等待什么决定。
ReviewItem：业务工作台里给人处理的正式审批任务。
```

```prisma
model AgentReviewGate {
  id                  String                 @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  missionId           String                 @map("mission_id") @db.Uuid
  runId               String                 @map("run_id") @db.Uuid
  toolCallId          String?                @map("tool_call_id") @db.Uuid
  reviewItemId        String?                @map("review_item_id") @db.Uuid
  status              AgentReviewGateStatus  @default(PENDING)
  reasonCode          String                 @map("reason_code") @db.VarChar(96)
  question            String                 @db.Text
  agentRecommendation String?                @map("agent_recommendation") @db.Text
  riskIfApproved      String?                @map("risk_if_approved") @db.Text
  riskIfRejected      String?                @map("risk_if_rejected") @db.Text
  evidenceRefsJson    Json                   @default("[]") @map("evidence_refs_json") @db.JsonB
  decision            String?                @db.VarChar(64)
  decisionComment     String?                @map("decision_comment") @db.Text
  decidedBy           String?                @map("decided_by") @db.VarChar(128)
  decidedAt           DateTime?              @map("decided_at") @db.Timestamptz(6)
  createdAt           DateTime               @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  mission             AgentMission           @relation(fields: [missionId], references: [id], onDelete: Cascade)
  run                 AgentRun               @relation(fields: [runId], references: [id], onDelete: Cascade)
  toolCall            AgentToolCall?         @relation(fields: [toolCallId], references: [id], onDelete: SetNull)

  @@index([missionId, status], map: "agent_review_gates_mission_status_idx")
  @@index([runId, status], map: "agent_review_gates_run_status_idx")
  @@index([reviewItemId], map: "agent_review_gates_review_item_idx")
  @@map("agent_review_gates")
}
```

## 6. 与现有模型的关系

P0 建议先用普通 UUID 字段关联现有表，例如 `workflowRunId`、`workflowStepId`、`reviewItemId`，避免一次迁移同时修改太多既有模型。若需要 Prisma 强关系，可以在实现时给 `WorkflowRun`、`WorkflowStep`、`ReviewItem` 增加反向 relation 字段，并单独验证 migration。

### 6.1 WorkflowRun / WorkflowStep

`AgentRun` 是 Copilot 侧 run，`WorkflowRun` 是全局工作流审计。

建议：

```text
每个 AgentRun 创建一个 WorkflowRun。
每个 AgentToolCall 创建或关联一个 WorkflowStep。
Pi lifecycle event 不一定都建 WorkflowStep，但必须进 AgentRunEvent。
重要阶段：context assembly、tool call、review gate、final report 建 WorkflowStep。
```

`WorkflowRun.inputJson` 建议：

```json
{
  "source": "agent_copilot",
  "missionId": "uuid",
  "sessionId": "uuid",
  "objective": "为天猫618黄金类目准备可报名 SKU",
  "workbenchContext": {}
}
```

### 6.2 ReviewItem

Review Gate 有两种情况：

```text
runtime-only gate：
例如等待用户确认是否继续，不一定创建 ReviewItem。

business review gate：
例如折扣口径、证书缺失、补货建议，需要创建 ReviewItem。
```

创建 ReviewItem 后：

```text
AgentReviewGate.reviewItemId = ReviewItem.id
ReviewItem.evidenceJson 包含 gateId / runId / toolCallId
```

### 6.3 Evidence

P0 不新增 EvidenceRef 表，统一使用：

```ts
interface EvidenceRef {
  sourceType: "sku_snapshot" | "rule_set" | "simulation_result" | "review_item" | "workflow_step" | "agent_tool_call";
  sourceId: string;
  field?: string;
  rawValue?: unknown;
  normalizedValue?: unknown;
  ruleId?: string;
  evidenceText?: string;
  collectedAt?: string;
}
```

## 7. 后端模块架构

建议目录：

```text
apps/backend/src/agent/
├── api/
│   ├── AgentSessionController.ts
│   ├── AgentMissionController.ts
│   ├── AgentRunController.ts
│   └── AgentContextController.ts
├── api/dto/
│   ├── CreateAgentMissionRequestDto.ts
│   ├── StartAgentRunRequestDto.ts
│   ├── SendAgentMessageRequestDto.ts
│   ├── AgentRunEventResponseDto.ts
│   └── ReviewGateDecisionRequestDto.ts
├── application/
│   ├── AgentSessionService.ts
│   ├── AgentMissionService.ts
│   ├── AgentRunService.ts
│   ├── AgentEventStore.ts
│   └── AgentContextAssembler.ts
├── runtime/
│   ├── AgentLoopAdapter.ts
│   ├── PiAgentLoopAdapter.ts
│   ├── VercelAiModelAdapter.ts
│   └── AgentRunEventMapper.ts
├── tools/
│   ├── AgentToolRegistry.ts
│   ├── AgentToolExecutor.ts
│   ├── activityTools.ts
│   ├── skuTools.ts
│   ├── reviewTools.ts
│   └── reportTools.ts
├── safety/
│   ├── ToolPolicy.ts
│   ├── ReviewGatePolicy.ts
│   ├── LoopGuard.ts
│   └── ToolResultSanitizer.ts
└── repository/
    ├── AgentSessionRepository.ts
    ├── AgentMissionRepository.ts
    ├── AgentRunRepository.ts
    ├── AgentMessageRepository.ts
    ├── AgentRunEventRepository.ts
    ├── AgentToolCallRepository.ts
    ├── AgentContextRepository.ts
    └── AgentReviewGateRepository.ts
```

## 8. Service 职责

### AgentMissionService

- 创建 Mission。
- 更新 Mission 状态。
- 根据 workbench context 建初始 plan。
- 聚合 Mission 详情 DTO。
- 将 Mission 与业务主体关联。

### AgentRunService

- 启动 Pi run。
- 创建 WorkflowRun。
- 持久化 AgentRun。
- 接收 Pi events 并写入 AgentRunEvent。
- 根据事件更新 AgentRun / AgentMission 状态。
- 支持 cancel / resume。

### AgentContextAssembler

- 读取 stable system context。
- 读取 Mission context。
- 读取 WorkbenchContext。
- 读取业务 evidence summary。
- 控制 context 大小与敏感字段。

### AgentToolRegistry

- 注册可调用工具。
- 提供 Pi tool schema。
- 将 Pi tool call 映射到 `AgentToolExecutor`。
- 禁止未注册工具。

### AgentToolExecutor

- 执行工具前写 `AgentToolCall`。
- 调用 `ToolPolicy` 和 `ReviewGatePolicy`。
- 通过 application service 执行业务逻辑。
- 写 outputJson / evidenceRefsJson。
- 写 WorkflowStep。

### ReviewGatePolicy

- 判断工具是否必须暂停。
- 创建 AgentReviewGate。
- 必要时创建 ReviewItem。
- 审批通过后允许 run 继续。

### AgentEventStore

- 分配 run 内递增 sequence。
- 写 AgentRunEvent。
- 支持 `lastEventId` 之后的事件查询。
- 为 SSE 提供重放能力。

## 9. API 设计

### 9.1 创建 Mission

```text
POST /api/agent/missions
```

Request：

```json
{
  "sessionKey": "console:user_001",
  "missionType": "ACTIVITY_RULE_EXECUTION",
  "objective": "为天猫618黄金类目准备可报名 SKU",
  "autonomyLevel": "L2_REVIEW_GATED_AGENT",
  "constraints": {
    "platform": "tmall",
    "category": "黄金",
    "deadline": "2026-06-10T18:00:00+08:00"
  },
  "workbenchContext": {
    "route": "/activities",
    "pageTitle": "活动规则与准入模拟",
    "selectedEntity": {
      "entityType": "activityRuleSet",
      "entityId": "rule_set_618",
      "label": "天猫618黄金类目规则"
    }
  }
}
```

Response：

```json
{
  "missionId": "uuid",
  "sessionId": "uuid",
  "status": "DRAFT",
  "plan": []
}
```

### 9.2 启动 Run

```text
POST /api/agent/missions/:missionId/runs
```

Response：

```json
{
  "runId": "uuid",
  "piRunId": "pi_run_abc",
  "workflowRunId": "uuid",
  "status": "QUEUED",
  "acceptedAt": "2026-05-23T18:00:00.000Z",
  "eventsUrl": "/api/agent/runs/uuid/events"
}
```

### 9.3 订阅事件

```text
GET /api/agent/runs/:runId/events?after=42
```

说明：

- 使用 SSE。
- `after` 对应 `AgentRunEvent.sequence`。
- 前端断线后用最后收到的 sequence 继续拉。

### 9.4 发送消息

```text
POST /api/agent/runs/:runId/messages
```

Request：

```json
{
  "content": "为什么 G003 不能直接报名？",
  "workbenchContext": {
    "route": "/sku-health",
    "selectedEntity": {
      "entityType": "sku",
      "entityId": "sku_profile_g003",
      "label": "G003"
    }
  }
}
```

### 9.5 Review Gate 决策

```text
POST /api/agent/review-gates/:gateId/decision
```

Request：

```json
{
  "decision": "APPROVED",
  "comment": "折扣力度按活动价 / 原价计算",
  "decidedBy": "operator_001",
  "modifiedInput": {
    "discountBase": "originalPrice"
  }
}
```

### 9.6 取消 Run

```text
POST /api/agent/runs/:runId/cancel
```

## 10. 核心流程

### 10.1 从工作台创建 Mission

```text
1. 前端收集 WorkbenchContext。
2. POST /api/agent/missions。
3. AgentMissionService upsert AgentSession。
4. 创建 AgentMission。
5. AgentContextAssembler 生成初始上下文摘要。
6. 返回 missionId。
```

### 10.2 启动 Pi Run

```text
1. POST /api/agent/missions/:missionId/runs。
2. AgentRunService 创建 AgentRun。
3. 创建 WorkflowRun。
4. PiAgentLoopAdapter 创建 Pi session / run。
5. AgentEventStore 写 lifecycle accepted。
6. SSE 开始推送事件。
```

### 10.3 工具调用

```text
1. Pi 发起 tool call。
2. AgentToolRegistry 校验 tool name。
3. AgentToolExecutor 创建 AgentToolCall。
4. ToolPolicy 校验权限、风险等级、参数 schema。
5. ReviewGatePolicy 判断是否暂停。
6. 如果无需暂停，调用对应 application service。
7. 写 AgentToolCall.outputJson。
8. 写 WorkflowStep。
9. 写 AgentRunEvent tool end。
10. 将结果返回 Pi。
```

### 10.4 Review Gate

```text
1. ReviewGatePolicy 判断需要人工确认。
2. 创建 AgentReviewGate。
3. 必要时创建 ReviewItem。
4. AgentRun.status = PAUSED。
5. AgentMission.status = WAITING_FOR_REVIEW。
6. SSE 推送 review_gate。
7. 前端显示审批区域。
8. 人工提交 decision。
9. 更新 AgentReviewGate / ReviewItem。
10. AgentRunService 恢复 Pi run 或启动 continuation run。
```

### 10.5 页面与 Chat 对照

```text
1. 页面选中 SKU / Rule / Review。
2. 前端更新 WorkbenchContext。
3. 用户向 Agent 提问。
4. AgentContextAssembler 将选中对象放入上下文。
5. Agent 调 explainDecisionWithEvidence。
6. 返回 linkedEntityRefs。
7. 前端高亮工作台对应行、字段或详情抽屉。
```

## 11. Tool Registry P0 定义

建议先只开放 6 个工具，降低接入风险：

```text
parseActivityRules
extractExecutionRequirements
checkDataFreshness
simulateActivityReadiness
createReviewItems
explainDecisionWithEvidence
```

工具定义示例：

```ts
const simulateActivityReadinessTool = {
  name: "simulateActivityReadiness",
  label: "执行活动准入模拟",
  service: "ActivitySimulationService",
  method: "simulate",
  permission: "simulate",
  riskLevel: "L1",
  reviewPolicy: "none",
  evidencePolicy: "required",
  inputSchema: {
    activityRuleSetId: "string",
    scope: "object",
  },
  outputSchema: {
    simulationRunId: "string",
    summary: "object",
    evidenceRefs: "array",
  },
};
```

## 12. Pi 接入边界

`PiAgentLoopAdapter` 是 Agent harness / loop runtime 适配层，不应直接依赖业务 service。它只依赖：

```text
VercelAiModelAdapter
AgentContextAssembler
AgentToolRegistry
AgentEventStore
AgentRunRepository
```

调用方向：

```text
PiAgentLoopAdapter
    ↓
VercelAiModelAdapter
    ↓
AgentToolRegistry
    ↓
AgentToolExecutor
    ↓
Application Services
```

这样未来替换 Pi、升级 Pi 或临时退回内部 runtime，都不会影响业务层。

## 13. 失败与恢复策略

| 失败类型 | 处理 |
|---|---|
| Pi run timeout | AgentRun.status = TIMEOUT，Mission = FAILED 或 WAITING_FOR_REVIEW |
| 工具参数校验失败 | ToolCall = FAILED，写 error event，Agent 可修正参数重试 |
| 工具重复失败 | LoopGuard 暂停，创建 ReviewGate |
| 数据过期 | Mission = WAITING_FOR_DATA，提示连接器采集 |
| Review 被拒绝 | Mission 重新规划或 CANCELED |
| SSE 断线 | 前端带 `after=lastSequence` 重连 |
| 页面刷新 | 通过 missionId/runId 恢复 Mission、Run、Messages、Events |

## 14. 实施顺序

### Step 1：Prisma schema

- 新增 Agent enums。
- 新增 9 张 Agent 表。
- 建 migration。
- 跑 `prisma validate`。

### Step 2：Repository / CRUD

- 按表生成 repository。
- 先实现 create / updateStatus / findById / listByMission / appendEvent。

### Step 3：AgentEventStore

- 实现 run 内 sequence 分配。
- 支持 append event。
- 支持 list events after sequence。

### Step 4：AgentMissionService

- upsert session。
- create mission。
- create initial context snapshot。
- return Mission DTO。

### Step 5：AgentRunService

- create run。
- create WorkflowRun。
- start adapter。
- consume adapter events。
- update statuses。

### Step 6：Tool Registry

- 注册 P0 六个工具。
- 工具先返回 mock 或调用现有 service。
- 每个工具必须输出 evidenceRefs。

### Step 7：PiAgentLoopAdapter

- 接 Pi SDK。
- 关闭默认 coding/file/bash 工具。
- 接入 `VercelAiModelAdapter`，继续由 Vercel AI SDK 负责 LLM provider 和 tool schema。
- 注入业务 custom tools。
- 映射 lifecycle / assistant / tool events。

### Step 8：SSE API

- `GET /api/agent/runs/:runId/events`。
- 支持 `after`。
- 前端侧边栏消费。

### Step 9：Review Gate

- 工具调用前执行 policy。
- 创建 gate。
- 决策后 continuation run。

## 15. 最小验收标准

后端 P0 完成的定义：

```text
1. 可以创建 AgentSession / AgentMission / AgentRun。
2. 可以写入并重放 AgentRunEvent。
3. 可以记录 AgentToolCall。
4. 可以将 AgentRun 关联到 WorkflowRun。
5. 可以通过 Tool Registry 调用至少 3 个业务工具。
6. 可以在需要人工确认时创建 AgentReviewGate。
7. 可以通过 SSE 让前端看到 lifecycle、assistant_delta、tool、review_gate。
8. Pi 默认高危工具未暴露。
```

## 16. 待确认问题

1. 用户身份是否先用字符串占位，还是接入正式 auth。
2. Pi session 文件放在哪里，是否需要加密或只存引用。
3. P0 是否立即建 `AgentContextSnapshot`，还是先放进 `AgentRun.inputJson`。
4. Review Gate 被批准后，是恢复同一个 Pi run，还是启动 continuation run。建议 P0 用 continuation run，工程更稳。
5. 是否需要给 `AgentToolDefinition` 建表。建议 P0 先代码注册，P1 再后台可配置。
