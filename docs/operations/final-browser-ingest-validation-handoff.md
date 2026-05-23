# final-browser-ingest-validation 交接文档

日期：2026-05-24

## 完成范围

- 完成浏览器插件 Layer 4B 真实 ingest 验证闭环。
- 用脱敏 fixture 固定四类真实抖店库存输入：
  - 库存第一页：`realDoudianStockListFirstPageFixture`
  - 翻页：`realDoudianStockListSecondPageFixture`
  - 筛选：`realDoudianStockListFilteredFixture`
  - SKU 诊断输入：`realDoudianSkuStockDiagnoseRequestFixture`
- 验证 `page`、`pageSize`、`page_size`、`sort` 和筛选字段在 `buildStockListRequest` 中不丢失。
- 将插件真实提交默认路径切到 `POST /api/ingest`，提交前将 extension payload 转为 foundation `IngestPayloadDto` 兼容形状。
- 保留 `mock submit` fallback，仅用于开发、断网或后端不可用验证，不声明为生产默认路径。
- Side panel 展示 ingest receipt、失败原因、采集风险和员工工作台 `SKU 健康` 入口。
- 评论 payload 当前只保留为预览和后续扩展输入；生产默认真实提交只走已冻结的 `POST /api/ingest`。

## Route / API

生产默认提交：

```txt
POST /api/ingest
```

提交 DTO：

```txt
connectorId = doudian-browser-extension
collectedAt = extension collectedAt
rows[].platform = doudian
rows[].storeId = 当前页面 host，默认 fxg.jinritemai.com
rows[].externalSkuId = 抖店 sku_id
rows[].productName = product_name + sku_name
rows[].category = category_id 字符串
rows[].stock = total_unoccupied_stock_num
rows[].campaignPrice = salePrice，库存接口缺失时不传
rows[].raw = 原始商品/SKU字段 + extensionWarnings + extensionRunId
```

后端返回 envelope：

```txt
{ code, message, data, requestId }
```

插件 receipt 解析优先级：

```txt
data.workflowRunId -> data.submitId -> data.runId -> REAL-INGEST-{runId}
data.acceptedRows -> data.summaries.length -> payload.rows.length
```

## Fallback

- `submitToRealIngestApi` 默认提交 `/api/ingest`。
- 当前没有使用 `/api/ingest/comments` 作为生产默认 route；评论采集不声明真实提交完成。
- `mock submit` 按钮仍在 side panel footer，便于离线演示和后端不可用时验证 UI receipt。
- mock fallback 不保存 Cookie、token、JWT、SSO，也不声明为生产默认路径。

## 验证命令与结果

```txt
openspec validate final-browser-ingest-validation --strict
结果：通过

scripts/typecheck extension
结果：通过

scripts/test extension
结果：通过，输出 extension ingest real doudian fixture smoke passed

scripts/build extension
结果：通过；Plasmo 提示 svgo 未安装但构建完成

scripts/typecheck frontend
结果：通过
```

HTTP smoke：

```txt
NODE_OPTIONS="${NODE_OPTIONS:-} --no-experimental-webstorage" pnpm --dir apps/frontend exec next dev -p 3187
curl -X POST http://127.0.0.1:3187/api/ingest -H 'content-type: application/json' --data @/tmp/final-browser-ingest-smoke-payload.json
curl http://127.0.0.1:3187/api/health/summary
```

结果：

- `POST /api/ingest` 返回 `code: OK`，生成 `workflowRunId: workflow_0002`。
- `GET /api/health/summary` 返回 `total: 1, warning: 1`。

## 截图 / 日志证据

```txt
docs/operations/evidence/final-browser-ingest-validation/http-smoke-ingest-response.json
docs/operations/evidence/final-browser-ingest-validation/http-smoke-health-summary.json
docs/operations/evidence/final-browser-ingest-validation/http-smoke-health-status.txt
docs/operations/evidence/final-browser-ingest-validation/sku-health-page.png
```

截图命令：

```txt
npx --yes playwright install chromium
npx --yes playwright screenshot --wait-for-timeout=1000 http://127.0.0.1:3187/sku-health docs/operations/evidence/final-browser-ingest-validation/sku-health-page.png
```

## 敏感信息处理

- 没有读取、复制、保存 Cookie、token、JWT、SSO 或模型密钥。
- fixture 只保存脱敏商品/SKU/库存结构、请求参数和少量字段样例。
- payload 敏感字段扫描仍由 `assertNoSensitivePayloadKeys` 覆盖。

## 风险

- 非阻塞 L1：当前真实 HTTP smoke 使用 frontend in-memory foundation，服务重启后数据清空；这与 `final-api-persistence-foundation` 当前交接一致，不阻塞 Layer 4B/4C/4D。
- 非阻塞 L1：库存接口没有 sale price 和类目名称，插件只标记采集风险；价格/类目名需要后续真实价格接口或详情接口补充。
- 非阻塞 L1：`scripts/build extension` 输出 htmlnano/svgo 提示，但 Plasmo build 完成。
- 非阻塞 L1：指定的 `docs/operations/pickagent-final-design-work-allocation.md` 在本 worktree 当前基线不存在；本次依据 OpenSpec、tracker 和上游 handoff 执行。

## 结论

`final-browser-ingest-validation` tasks 3.1 到 3.5 已完成，可声明不阻塞 Layer 4B/4C/4D。生产持久化仍依赖后续 PostgreSQL/Prisma adapter，但插件真实 ingest route、payload 转换、fallback、receipt 和证据链已闭合。
