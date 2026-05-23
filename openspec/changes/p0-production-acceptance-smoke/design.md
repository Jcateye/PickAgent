## Context

本子 change 是 P0 完成判定，不替代单元测试和 integration test。它只验证生产启动方式下的最小跨模块闭环。

## Requirements Boundary

- smoke 必须先 `build` 再 `start`。
- smoke 必须使用纯净 fixture 或隔离 tenant/session，避免默认 seed 污染关键 totals。
- smoke 必须覆盖 L4 链路 A/B/C/D。
- smoke 必须覆盖服务重启后 persistence 查询、Agent replay、ReviewItem 关联和 dangerous tool denial。
- evidence 必须归档到稳定目录并写入中文验收报告。

## Forbidden Scope

- 不用 Next dev 截图作为生产通过证据。
- 不把 fake runtime 默认路径计为 production pass。
- 不在 smoke 脚本中实现生产业务逻辑。
- 不在仓库保存真实数据库密钥。

## Verification

- `openspec validate p0-production-acceptance-smoke --strict`
- `./scripts/build`
- `./scripts/start`
- `node scripts/p0-production-acceptance-smoke.mjs` 或等价 stub 后续实现
- browser smoke 覆盖桌面和移动关键页面，记录日志和截图路径。
