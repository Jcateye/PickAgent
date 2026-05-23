# Scripts

根目录 `scripts/` 是 PickAgent 的统一门面入口目录。

## 当前目标

对外暴露一组稳定脚本入口，统一驱动：

- 总控制台开发与构建
- 浏览器插件开发与构建
- 服务端类型检查、测试、迁移
- demo 部署

## 当前建议脚本集合

- `bootstrap`
- `dev`
- `test`
- `lint`
- `typecheck`
- `build`
- `migrate`
- `deploy`

## 当前项目语义

| 脚本 | 作用 | 对应项目语义 |
|---|---|---|
| `bootstrap` | 初始化项目 | 安装依赖、准备 `.env`、初始化本地数据库说明 |
| `dev` | 启动开发环境 | 启动 `apps/frontend`、`apps/backend`、`apps/extension` 的本地开发模式 |
| `test` | 运行测试 | 执行后端规则测试、前端关键测试、插件最小验证 |
| `lint` | 静态检查 | 前端 / 后端 / 插件 lint |
| `typecheck` | 类型检查 | TypeScript typecheck、contracts 一致性检查 |
| `build` | 构建制品 | 构建总控制台与插件，必要时构建后端服务 |
| `migrate` | 数据库迁移 | 执行 Prisma migration |
| `deploy` | 执行部署 | 发布 demo 环境并执行最小验证清单 |

## 当前约束

- 外部文档、CI、agent 自动化优先调用门面入口，不直接绑定底层工具命令
- 插件、前端、后端若内部命令不同，应在脚本内部做统一封装
- 若某脚本暂未实现，应在对应子目录 README 中说明计划行为

## 当前状态

- 目录结构已预留
- 具体脚本实现尚未正式初始化
- 下一步应在工程骨架启动时统一补全这些脚本
