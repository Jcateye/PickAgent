# final-staff-health-api-closure 交接文档

日期：2026-05-24

## 完成范围

- Dashboard 默认消费 `GET /api/health/summary` 的统一 envelope，并显式展示 `REAL API` / `EMPTY API` / `FALLBACK` 状态。
- SKU Health 默认消费 `GET /api/skus` 与 `GET /api/skus/:skuProfileId`，列表只展示服务端 summary/projection DTO，详情只展示 detail DTO。
- SKU detail 增加 snapshot、diagnosis、collection risk、evidence source 的可追溯区域。
- Connectors 页面收口为健康工作台 API 状态面板，展示 `Health Summary API` 与 `SKU List API` 的连接状态，不控制插件自动化。
- API error、empty、fallback 均在页面显式显示；mock fallback 只作为接口不可用时的开发降级，不声明为生产默认路径。

## Route / API

- `GET /api/health/summary`
  - 页面：Dashboard、Connectors。
  - 用途：展示 total / ready / warning / blocked。
- `GET /api/skus?pageSize=100`
  - 页面：SKU Health、Connectors。
  - 用途：展示 SKU list / CurrentSkuProjection 风格摘要。
- `GET /api/skus/:skuProfileId`
  - 页面：SKU Health detail。
  - 用途：展示 latestSnapshot、latestDiagnosis、evidence、nextActions。
- `POST /api/ingest`
  - 验证用 smoke seed；本 change 未改变 ingest route。

所有 API 均按 foundation 统一 envelope 读取：`{ code, message, data, requestId }`。

## Fallback 策略

- `REAL API`：API envelope `code=OK` 且 `data` 可用。
- `EMPTY API`：真实 API 返回成功但 summary/list 当前为空。
- `FALLBACK`：API 不可用、非 OK、404 或 fetch 失败，页面展示 mock/fallback 并写明原因。
- 前端没有基于 snapshot / diagnosis 重算 `healthStatus`、`healthScore`、`dataQualityScore` 或 `nextAction`。

## 验证命令

- `openspec validate final-staff-health-api-closure --strict`：通过。
- `scripts/typecheck`：通过。
- `scripts/lint`：通过。
- `scripts/build`：通过。Plasmo build 输出 `htmlnano` 建议安装 `svgo` 的既有提示，但构建成功。
- `scripts/test`：通过，当前脚本执行 repo typecheck。

## Smoke / 截图

Dev server：`http://localhost:3003`（3000 被占用，Next 自动选择 3003）。

Smoke seed：

- `output/playwright/final-staff-health-api-closure/ingest-smoke.json`
- `output/playwright/final-staff-health-api-closure/health-summary.json`
- `output/playwright/final-staff-health-api-closure/skus.json`
- `output/playwright/final-staff-health-api-closure/sku-detail.json`

截图：

- 桌面 SKU Health：`output/playwright/final-staff-health-api-closure/desktop-sku-health.png`
- 桌面 Dashboard：`output/playwright/final-staff-health-api-closure/desktop-dashboard.png`
- 移动 SKU Health：`output/playwright/final-staff-health-api-closure/mobile-sku-health.png`

Playwright console：

- `output/playwright/final-staff-health-api-closure/playwright-console.log`
- 仅有 React DevTools 提示与 favicon 404；未发现业务 JS error。

## 缺失输入

- 指定必读文档 `docs/operations/pickagent-final-design-work-allocation.md` 在本 worktree 中不存在。已读取 OpenSpec、架构、工程规则和 foundation handoff，未因此阻塞实现。

## 风险

- 非阻塞 L1：foundation 仍是 in-memory repository，满足当前收口验证，但不是生产持久化路径。
- 非阻塞 L1：Connectors 没有独立冻结的 `GET /api/connectors` route，本 change 用 health summary / sku list API 状态表达连接器可用性。
- 非阻塞 L0：截图 smoke 依赖 dev server 当前进程内存；重启后需重新 POST `/api/ingest` 才能复现同一数据。

## 结论

可声明 `final-staff-health-api-closure` 已完成，不阻塞 Layer 4B/4C/4D。
