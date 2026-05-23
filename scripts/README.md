# Scripts

根目录 `scripts/` 是 PickAgent 的统一运维入口。外部文档、CI、agent 自动化和人工操作都优先调用这里的门面脚本，不直接写死底层 `pnpm`、`npm`、`plasmo`、`tsc` 或 `prisma` 命令。

## Usage

```bash
./scripts/cli <action> <module> [args...]
```

也可以直接调用具体脚本：

```bash
./scripts/dev frontend
./scripts/build repo
./scripts/typecheck backend
```

## Actions

| Action | 作用 |
|---|---|
| `bootstrap` | 安装模块依赖 |
| `dev` | 启动本地开发进程 |
| `build` | 构建可部署或可加载制品 |
| `lint` | 运行当前可用静态检查 |
| `typecheck` | 运行 TypeScript / Prisma schema 检查 |
| `test` | 运行当前可用自动化测试；测试脚本未落地时执行 smoke typecheck |
| `migrate` | 执行数据库 migration |
| `deploy` | 执行发布前构建；默认 `DEPLOY_TARGET=dry-run` |

## Modules

| Module | 对应范围 |
|---|---|
| `repo` | 当前仓库聚合目标 |
| `frontend` | `apps/frontend`，员工工作台 + Agent Copilot UI |
| `backend` | `apps/backend`，服务端骨架、Prisma schema、application services |
| `extension` | `apps/extension`，浏览器插件与页面数据采集入口 |
| `agent-workbench` | Agent Copilot 工作台相关前端 + 后端校验 |

常用别名：

| Alias | Module |
|---|---|
| `all` | `repo` |
| `plugin`, `browser-extension` | `extension` |
| `employee-workbench`, `admin` | `frontend` |
| `agent`, `hermes` | `agent-workbench` |

## Examples

```bash
./scripts/cli bootstrap repo
./scripts/cli dev frontend
./scripts/cli dev extension
./scripts/cli build repo
./scripts/cli build extension
./scripts/cli lint repo
./scripts/cli typecheck backend
./scripts/cli test agent-workbench
./scripts/cli migrate backend --tcp
./scripts/cli deploy repo
```

## 当前模块行为

- `frontend`：通过 `pnpm --dir apps/frontend` 运行 `dev/build/lint/typecheck`。
- `extension`：通过 `npm run` 运行 Plasmo 的 `dev/build/typecheck`。
- `backend`：当前没有独立 `package.json` 和 HTTP dev server，门面脚本会执行 Prisma schema validate 和后端 TypeScript smoke typecheck。
- `agent-workbench`：当前 Hermes / Agent Copilot 工程落在 `frontend` UI 与 `backend` Agent 数据结构 / service 骨架中，门面脚本会组合执行两侧检查。
- `repo`：聚合执行 backend、frontend、extension 当前可用的检查或构建。

## 部署约束

`scripts/deploy` 默认是 dry-run，不会真实发布：

```bash
DEPLOY_TARGET=dry-run ./scripts/deploy repo
```

`DEPLOY_TARGET=demo` 目前会先执行构建，然后明确停止在发布步骤，因为 demo hosting provider 和发布命令尚未在 ADR 中确认。确认后只需要在 `scripts/deploy` 内部接入发布命令，外部调用方式保持不变。
