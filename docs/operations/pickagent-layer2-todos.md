# PickAgent Layer 2 遗留项与依赖记录

日期：2026-05-23

## 当前收口状态

- Layer 1 已全部合入 `main` 并验收通过。
- Layer 2 后端基座已合入 `main`。
- 抖店 HTTP 记录分析文档已合入 `main`：`docs/doudian-http-records-analysis.md`。
- Layer 2 主线验证通过：
  - `scripts/typecheck backend`
  - `scripts/test backend`
  - `npx --yes tsx --test apps/backend/tests/unit/backendBusinessFoundation.test.ts`

## 已解锁的下游能力

| 下游模块 | 解锁状态 | 说明 |
|---|---:|---|
| 浏览器插件真实 ingest | 已解锁 | 已有抖店 HTTP 记录到标准 ingest rows 的离线映射。 |
| 健康工作台真实查询 | 已解锁 | 库存字段可进入 current projection。 |
| 活动模拟真实 parse/simulation | 已解锁 | 商机线索先进入 `manual_review` DSL。 |
| Review/报告真实接口 | 已解锁 | 现有 ReviewService/ReportService 可消费 simulation/evidence。 |
| Agent tools | 已解锁 | 工具仍通过 application service 边界执行。 |

## 遗留 TODO / 依赖项

### P0：Layer 3 前必须处理

1. **真实抖店页面 fixture 替换**
   - 当前 Layer 1 插件仍使用 synthetic fixture。
   - 需要用 `source/business-http-records-2026-05-23-11-53-35.json` 中的脱敏响应结构生成/替换真实 fixture。
   - 不允许提交 token、Cookie、JWT、SSO 标识或完整原始 response body。
   - Layer 3 处理：已新增插件脱敏 fixture `apps/extension/src/lib/fixtures/real-doudian-http.ts`，只保留 `stock/manage/list` 与 `sku_stock_diagnose` 的必要商品/SKU/状态/库存字段，不包含 token、Cookie、JWT、SSO 标识或完整 response body。

2. **插件真实采集 adapter**
   - 主接口：`POST /stock/manage/list`。
   - SKU 诊断：`POST /stock/manage/sku_stock_diagnose`。
   - Layer 3 插件 agent 需要实现从当前抖店页面上下文发起请求，依赖浏览器当前会话，不复制 Cookie。
   - Payload 按 `product_id + sku_id` 展开为 SKU 行。
   - Layer 3 处理：已新增 `apps/extension/src/lib/ingest/doudian-http-adapter.ts`，在当前页面上下文以 `credentials: "include"` 调用库存列表与诊断接口，按 `product_id + sku_id` 展开为标准采集行，不读取、不复制、不保存 Cookie/token。

3. **价格字段缺口**
   - `stock/manage/list` 没有明确 sale price。
   - 需要另录商品列表、商品详情或价格接口；否则 Layer 3 只能标记价格缺失风险。
   - Layer 3 处理：当前 adapter 将 `salePrice` 保持为 `null`，并为每行标记“缺少价格字段，stock/manage/list 未返回 sale price。”采集层风险。

4. **类目名称缺口**
   - 当前库存接口主要给 `category_id`，类目名称来源需确认。
   - 可先保留 `category_id`，类目名作为待补字段。
   - Layer 3 处理：当前 adapter 将 `category_id` 写入 `category` 与 `raw.fxg`，并标记“缺少类目名称，仅保留 category_id。”采集层风险。

### P1：Layer 3 接真实接口时处理

5. **分页/筛选参数确认**
   - 需要验证 `page/pageSize`、`page_size`、排序、商品状态、库存告警、类目/仓库筛选等真实请求体。
   - 需要确认最大 page size 和翻页过程中 token 是否刷新。
   - Layer 3 处理：adapter 已实现 `page/pageSize/page_size/sort` 的受控分页循环；最大 page size、筛选参数和 token 刷新行为仍需真实页面操作验证。

6. **状态码字典确认**
   - `status`、`draft_status`、`check_status`、`stock_type`、`shipping_mode`、`has_stock_occupied` 的业务含义需要对照页面显示确认。
   - Layer 3 处理：adapter 仅保留原始状态码到 `listingStatus` 与 `raw.fxg`，不在插件侧翻译为业务结论；字典含义仍需页面显示对照。

7. **SKU 诊断批量能力确认**
   - `sku_stock_diagnose` 当前只确认可返回 `is_alarming`。
   - 需要确认是否支持多 SKU、是否逐商品调用、频率限制如何。
   - Layer 3 处理：adapter 按商品批量提交 `sku_ids`，并将 `is_alarming` 作为采集层 warning/raw 字段保留；批量上限和频率限制仍需真实页面验证。

8. **业务商机线索的真实归属**
   - `business_chance_center/*` 暂作为活动/商机上下文，不是商品库存采集主链路。
   - 当前映射为 `manual_review` Rule DSL 线索；后续如需要自动规则解析，需要补充业务规则。

### P2：生产化前处理

9. **数据库 repository / transaction 接线**
   - Layer 2 目前完成 application service 与离线映射验证。
   - 尚未声明完成真实数据库事务落库、Prisma repository 和生产 API route。

10. **真实外部生产接口调用策略**
    - 当前只做离线解析，不主动请求外部生产接口。
    - 后续如插件调用真实接口，必须在用户当前商家后台页面上下文中发起，不能保存或复制敏感凭据。

11. **Pi/Hermes runtime 联调**
    - AgentToolRegistry/application service 边界已解锁。
    - 真实 Pi/Hermes runtime adapter 与业务工具调用仍需 Layer 3/4 联调。

12. **截图/录屏证据**
    - iab 当前不可用，本轮用 HTTP smoke 替代。
    - 最终验收前仍需要 UI 截图或录屏证据。

## 后续处理原则

- 每进入下一层前先检查本文件。
- 若 Layer 3/4 后仍有未解决项，最终统一拉一个收尾 agent 处理。
- 阻塞项必须标明归属模块，不能用“待后端/待前端”泛化。
