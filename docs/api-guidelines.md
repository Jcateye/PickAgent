# API Guidelines

> 本文件定义 SKU Ready Agent 项目的 HTTP API、Chat tool 契约边界、统一响应结构、错误码策略与版本管理约束。目标是让浏览器插件、总控制台和后续自动化调用共享同一套稳定接口。

## 1. 项目 API 设计原则

- API 表达资源语义，不表达页面语义
- 浏览器插件、总控制台、Chat tool 共用同一套后端服务能力
- Route Handler 保持薄，核心逻辑在 application services
- 所有外部输入必须先经过 Zod 校验
- LLM structured output 必须再次经过 Zod 校验后才能进入规则引擎
- API 设计优先服务主闭环：ingest → diagnosis → simulation → review → report

## 2. 当前推荐资源模型

- `connectors`
- `skus`
- `health`
- `activities`
- `simulations`
- `reviews`
- `reports`
- `workflows`
- `agent-events`
- `chat`

## 3. 推荐接口清单

### 3.1 插件 / ingest

- `POST /api/ingest`

用途：

- 接收插件提交的标准化前 rows
- 服务端执行校验、归一化、建档、写快照、触发诊断

### 3.2 健康总览与 SKU 查询

- `GET /api/health/summary`
- `GET /api/skus`
- `GET /api/skus/{skuProfileId}`

用途：

- Dashboard summary
- SKU List
- SKU Detail

要求：

- 读 current projection / detail DTO，不让前端自己拼 latest state

### 3.3 活动规则解析与模拟

- `GET /api/activities`
- `POST /api/activities/parse`
- `GET /api/activities/{activityId}`
- `POST /api/activities/{activityId}/simulations`
- `GET /api/activities/{activityId}/simulations/{runId}`

要求：

- 规则解析输出 Canonical Rule DSL
- simulation run 支持 `scopeJson` / what-if 输入
- activity eligibility 不覆盖日常 healthStatus

### 3.4 Review

- `GET /api/reviews`
- `POST /api/reviews/{reviewId}/decision`

要求：

- Review 是结构化审批动作，不是文本留言
- 必须记录决策状态、决策人、决策时间与 evidence

### 3.5 报告与工作流

- `POST /api/reports`
- `GET /api/workflows`
- `GET /api/workflows/{runId}`

### 3.6 外部 Agent 信号

- `POST /api/agent-events`

用途：

- 接收 A 战略 Agent / D 风控 Agent 信号
- 触发规则检查、Review 生成或上下文记录

### 3.7 Chat

- `POST /api/chat`

要求：

- Chat 不直接访问数据库
- Chat tools 只能复用 `SkuQueryService`、`ActivitySimulationService`、`ReportService` 等服务

## 4. 路径与命名约束

- 使用名词资源：`/skus`、`/activities`、`/reviews`
- 使用内部稳定 ID：
  - `skuProfileId`
  - `activityId`
  - `runId`
  - `reviewId`
- 不直接把外部平台 `skuId` 当公开 API 主路由 ID
- 对动作型接口使用子资源或动作后缀：
  - `POST /api/reviews/{reviewId}/decision`
  - `POST /api/activities/{activityId}/simulations`

## 5. 统一响应结构

### 5.1 成功

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "req_xxx"
}
```

### 5.2 失败

```json
{
  "code": "SKU.NOT_FOUND",
  "message": "SKU 不存在",
  "data": null,
  "requestId": "req_xxx",
  "details": {
    "skuProfileId": "sku_123"
  }
}
```

要求：

- `code` 稳定且可追踪
- `message` 面向调用方，不作为程序判断依据
- `requestId` 必须返回
- `details` 只在需要时返回，且不泄露敏感信息

## 6. 列表分页、过滤与排序

列表接口默认返回：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 100
  },
  "requestId": "req_xxx"
}
```

约束：

- 使用 `page` / `pageSize`
- 使用明确 query 参数，不暴露后端复杂查询表达式
- 排序字段用 `sortBy`
- 排序方向用 `sortOrder=asc|desc`

示例：

`GET /api/skus?page=1&pageSize=20&platform=tmall&healthStatus=REPAIRABLE&sortBy=updatedAt&sortOrder=desc`

## 7. 错误码建议

统一登记到 `apps/contracts/errors/`。

建议首批错误码：

- `COMMON.VALIDATION_ERROR`
- `CONNECTOR.UNSUPPORTED_PAGE`
- `CONNECTOR.INVALID_PAYLOAD`
- `INGEST.STALE_DATA`
- `INGEST.CONFLICTING_DATA`
- `SKU.NOT_FOUND`
- `RULE.PARSE_FAILED`
- `RULE.LOW_CONFIDENCE`
- `SIMULATION.NOT_FOUND`
- `REVIEW.NOT_FOUND`
- `REVIEW.REQUIRED`
- `WORKFLOW.FAILED`

## 8. 幂等与重复提交

重点接口建议支持幂等：

- `POST /api/ingest`
- `POST /api/activities/{activityId}/simulations`
- `POST /api/reviews/{reviewId}/decision`

推荐：

- 使用 `Idempotency-Key`
- 对 simulation run 和 review decision 记录幂等键与 requestId

## 9. OpenAPI / contracts 同步要求

- 所有 HTTP API 同步到 `apps/contracts/openapi/`
- 错误码同步到 `apps/contracts/errors/`
- API DTO 与共享 Zod schema 同步到 `apps/contracts/types/`
- 若接口结构影响前端或插件，必须在任务说明中写明影响面

## 10. Chat tool 契约原则

Chat 不是额外一套私有业务逻辑。

推荐工具：

- `getHealthSummary`
- `getSkuHealthDetail`
- `listReviewItems`
- `getActivitySimulationSummary`
- `simulateActivity`
- `generateReport`

原则：

- tool 定义在 `apps/backend/tools/`
- tool 只包装已存在的 application service
- 页面按钮与 tool action 复用同一服务逻辑

## 11. 禁止事项

- 不得让前端以多个原子接口自己拼 current state
- 不得让 Chat 直接持有数据库访问逻辑
- 不得返回与统一结构不一致的自定义响应体
- 不得直接暴露数据库内部字段作为长期外部契约
- 不得绕过 Zod 校验让插件 payload 或 LLM output 进入业务判断
