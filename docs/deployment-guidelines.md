# Deployment Guidelines

> 本文件定义 SKU Ready Agent 当前阶段的环境、构建、部署与回滚纪律。当前阶段以 **local / demo** 为主，目标是保证黑客松主链路稳定，而不是提前设计完整生产平台。

## 1. 当前环境分层

当前优先维护两个环境：

- `local`：本地开发与联调
- `demo`：黑客松演示环境

后续需要时再扩展：

- `dev`
- `staging`
- `prod`

## 2. 当前部署单元

### 2.1 总控制台

- `apps/frontend/`
- Next.js 应用

### 2.2 浏览器插件

- `apps/extension/`
- Plasmo 插件构建产物

### 2.3 后端

- 当前优先单应用服务端实现
- 可与前端同仓构建，后续再决定是否拆独立服务

### 2.4 数据库

- PostgreSQL
- 当前远程数据库不直接暴露公网连接，开发与 migration 通过 Cloudflare Access TCP 转发访问。

## 3. 当前建议的 demo 拓扑

```txt
Browser
├── SKU Ready Extension (Plasmo)
└── SKU Ready Console (Next.js)
       └── API / application services
              └── PostgreSQL
```

说明：

- 插件通过 HTTP 调用总控制台暴露的 ingest API
- 总控制台和服务端当前可以同部署单元
- 数据库独立于前端 / 插件构建

## 4. 配置与密钥管理

至少需要明确：

- `DATABASE_URL`
- LLM 相关环境变量（如使用 Vercel AI SDK provider key）
- 插件指向的 API base URL
- demo 环境与 local 环境的 URL 差异

要求：

- 不得硬编码密钥到仓库
- 插件与总控制台的 API 地址必须可配置
- demo 环境配置与 local 配置分离
- 远程数据库密钥只放在本机或密钥系统，不提交到仓库；当前本机约定通过 `POSTGRES_ENV_FILE` 指向外部 env 文件。

### 4.1 远程数据库连接方式

远程 PostgreSQL 通过 Cloudflare Access TCP 暴露给本机端口，不能直接把远程地址写进 `DATABASE_URL` 后访问。需要先在单独终端启动 TCP 转发：

```bash
cloudflared access tcp \
  --hostname postgres.justpyq.com \
  --url 127.0.0.1:15432
```

然后在另一个终端执行 migration 或数据库维护命令。当前项目统一使用 `scripts/migrate --tcp`：

```bash
POSTGRES_ENV_FILE=/Users/haoqi/clawd/infra/.secrets/staff-postgres-full.env \
  scripts/migrate --tcp
```

默认约定：

- 本机转发地址：`127.0.0.1:15432`
- 目标数据库：`pickagent`
- 密钥来源：`POSTGRES_ENV_FILE`
- TCP 模式需要 `POSTGRES_USER`、`POSTGRES_PASSWORD`，可选 `POSTGRES_DB`、`POSTGRES_MAINTENANCE_DB`、`POSTGRES_LOCAL_HOST`、`POSTGRES_LOCAL_PORT`

注意事项：

- `cloudflared access tcp` 进程必须保持运行，migration 完成后再关闭。
- 不要把 `/Users/haoqi/clawd/infra/.secrets/staff-postgres-full.env` 或其中内容提交到仓库。
- 如果只需要应用最新 SQL 文件，可显式传入 `MIGRATION_FILE=...`；默认 migration 文件以 `scripts/migrate` 内部配置为准，新增 migration 后要确认目标文件。
- 远程数据库属于共享环境时，执行 migration 前先确认当前分支、migration 范围和回滚思路。

## 5. 当前构建与发布原则

- 每次 demo 部署都应能追溯到具体代码版本
- 插件与总控制台可以分开构建，但必须共享同一版 contracts
- 构建结果必须与当前 Prisma schema / API contracts 匹配
- 不在运行时人工修改代码作为长期方案

## 6. 统一脚本入口

继续沿用根目录 `scripts/`：

- `scripts/bootstrap`
- `scripts/dev`
- `scripts/test`
- `scripts/lint`
- `scripts/typecheck`
- `scripts/build`
- `scripts/migrate`
- `scripts/deploy`

当前项目含义：

- `bootstrap`：安装依赖、初始化本地环境变量说明
- `dev`：同时或分别启动 frontend / backend / extension 开发模式
- `build`：构建总控制台与插件
- `migrate`：执行 Prisma migration
- `deploy`：发布 demo 环境

## 7. migration 与发布顺序

当前建议顺序：

1. 更新 contracts 与 Zod schema
2. 更新 Prisma schema 与 migration
3. 部署后端 / 总控制台 API
4. 验证 ingest → diagnosis → simulation → review 主链路
5. 构建 / 更新插件
6. 做 demo 验证

## 8. 最小发布验证清单

每次 demo 发布前至少验证：

- 插件能识别模拟商品列表页
- `/api/ingest` 可写入 snapshot 和 diagnosis
- 活动规则能成功 parse 或 fallback
- simulation 能输出 direct / repairable / manual review / blocked
- Review Workbench 能展示并处理 ReviewItem
- Dashboard 能读 current projection
- Chat 能调用 tools 返回真实数据

## 9. 回滚原则

当前黑客松阶段的回滚优先级：

- 回滚到上一版 demo 构建
- 回滚到上一版 migration 前的数据结构
- 临时关闭非主链路页面或功能，不阻塞主闭环

高风险变更必须明确：

- 是否影响 Prisma schema
- 是否影响 API contract
- 是否影响插件 payload
- 回滚后插件和总控制台是否仍兼容

## 10. 当前不建议提前做的部署动作

- 不急于设计完整 CI/CD 平台
- 不急于把插件发布到正式商店
- 不急于拆分多服务或事件总线
- 不急于设计生产级灰度 / 蓝绿方案

## 11. 禁止事项

- 不得在未确认回滚思路的情况下执行高风险 schema 变更
- 不得让插件与总控制台使用不兼容的 contracts 版本
- 不得先发布破坏性 API 再补前端或插件适配
- 不得跳过主闭环验证就宣称 demo 可用
