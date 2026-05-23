# Generated Schema Specs

本目录用于归档 SKU Ready Agent 的结构化 schema 规范与生成物。

## 当前用途

当项目开始落地 Prisma schema、OpenAPI schema、事件 schema 与共享 Zod schema 后，可把可再生的结构化规格归档到这里，便于：

- 审查 schema 变更
- 追踪生成来源
- 让前端、插件、后端共享一致的数据结构说明

## 当前目录约定

- `manifest.json`：记录 spec 文件与来源映射
- `backend/`：P0 数据表对应的后端 CRUD 生成规格归档
- 后续可按主题分目录，例如：
  - `prisma/`
  - `openapi/`
  - `events/`
  - `zod/`

## 当前项目的重点 schema

优先关注：

- ingest payload schema
- current projection schema
- activity rule parse schema
- simulation result schema
- review item schema
- report DTO schema

## 说明

- 这里存放的是可再生规格或归档文件，不是业务实现真相
- 真正的 owner 仍然是 `apps/backend/` 的 Prisma / Zod / API 实现与 `apps/contracts/` 契约目录
