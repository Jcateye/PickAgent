# PickAgent Contracts

`apps/contracts/` 是 SKU Ready Agent 的共享契约目录。

## 作用

在浏览器插件、集中式总控制台和服务端之间，提供统一、稳定、可追踪的契约定义。

## 子目录

- `openapi/`：HTTP API 契约
- `errors/`：稳定错误码定义
- `events/`：外部 Agent 信号、内部事件契约
- `types/`：共享 DTO、Zod schema、基础类型

## 当前重点契约

建议优先沉淀：

- ingest payload schema
- SKU summary / detail DTO
- activity rule parse DTO
- simulation result DTO
- review item DTO
- report DTO
- common response envelope

## 当前约束

- 每份契约必须有 owner
- contracts 只放契约，不放业务实现
- 所有对外 API 都要同步到 `openapi/`
- 所有错误码都要登记到 `errors/`
- 插件 payload、API input/output、LLM structured output 的共享 schema 要与服务端 Zod 保持一致

## 当前状态

- 目录已预留
- 具体 openapi、errors、types 内容尚未正式初始化
