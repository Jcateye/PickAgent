# 抖店 HTTP 记录接口分析

记录文件：`/Users/haoqi/OnePersonCompany/PickAgent/source/business-http-records-2026-05-23-11-53-35.json`

分析日期：2026-05-23

## 结论摘要

这份记录里，插件做真实抖店商品/库存采集时最需要关注的主接口是：

```txt
POST https://fxg.jinritemai.com/stock/manage/list
```

它来自页面 `https://fxg.jinritemai.com/ffa/g/stock-manage/list...`，响应约 564 KB，返回商品级字段、SKU 级字段、库存数量、占用数量、库存类型、操作状态和分页信息。它比 `/ffa/g/list` 页面上的商机中心接口更接近 extension ingest payload 的真实数据源。

`sku_stock_diagnose` 是库存诊断补充接口，目前样本只返回 `product_id`、`sku_id`、`is_alarming`，适合作为采集层风险补充字段，不应在插件内解释为健康诊断或活动准入结论。

`business_chance_center/*` 系列接口是商机/活动线索上下文，能提供机会名称、类目、热度、供需、扶持利益点等，但不是商品库存列表主数据源。它更适合后续活动机会上下文或规则来源分析，不应混入 Layer 3 商品采集主链路。

## 关键接口清单

| 优先级 | 接口 | 用途判断 | 是否进入插件 ingest 主链路 |
| --- | --- | --- | --- |
| P0 | `POST /stock/manage/list` | 库存管理商品/SKU 列表主接口，包含分页、商品、SKU、库存字段 | 是 |
| P1 | `POST /stock/manage/sku_stock_diagnose` | SKU 库存告警补充接口，按 `product_id + sku_ids` 查询 | 可作为采集层风险补充 |
| P2 | `POST /api/commop/business_chance_center/clue/common/real_time_list` | 商机/活动线索列表，来源为商品列表入口 | 否，作为后续机会上下文 |
| P2 | `POST /api/commop/business_chance_center/category/qualified/get` | 商机中心可用类目树/类目范围 | 否，作为类目上下文 |
| P2 | `POST /api/commop/business_chance_center/config/get` | 商机中心配置、准入说明、文案规则 | 否，作为规则/文案参考 |
| P3 | `GET /b/w/api/v1/main_frame/get_page_header`、`/reach/list`、`/pinpoint/pagepinpoint/get` | 页面头部、触达、引导点配置 | 否 |
| 排除 | `/report/submit_fe_barrier`、`/ecomauth/loginv1/select_sso`、`ecuser.zijieapi.com/ecom/gov/user/gen-did` | 前端埋点、登录/设备身份相关 | 不采集、不保存 |

## 主接口：库存管理列表

```txt
POST https://fxg.jinritemai.com/stock/manage/list?appid=1&__token=<redacted>&_bid=ffa_goods&_lid=<redacted>
```

### 请求体摘要

样本请求体：

```json
{
  "page": 1,
  "pageSize": 10,
  "page_size": 10,
  "sort": 0,
  "appid": 1,
  "__token": "<redacted>",
  "_bid": "ffa_goods",
  "_lid": "<redacted>"
}
```

分析：

- `page`：当前页，从样本看为 1 起始。
- `pageSize` / `page_size`：分页大小，样本两者都为 10，真实请求需要保留双字段直到 fixture 验证可删。
- `sort`：排序字段或排序模式，样本为 `0`，含义需页面操作验证。
- `appid`、`_bid`：前端业务标识，样本 `_bid=ffa_goods`。
- `__token`、`_lid`：会话/请求追踪参数，必须从浏览器当前页面上下文透传，不写入代码、不写入文档、不进入 ingest payload。

### 响应结构

顶层字段：

```txt
code
msg
log_id
page
size
total
advised_increase_spot_cnt
data[]
```

样本值：

- `code = 0`
- `msg = "success"`
- `page = 1`
- `size = 10`
- `total = 20`
- `data.length = 10`

`data[]` 是商品列表。商品级主要字段：

```txt
product_id
product_name
img
stock_type
warehouse_num
create_time
status
draft_status
check_status
total_stock_num
total_unoccupied_stock_num
total_occupied_stock_num
stock_occupy_infos
support_future_stock
spot_stock_num
future_stock_num
tags
skus[]
operations[]
forbid_edit
forbid_edit_reason
is_alarming
category_id
subscribe_cnt
shipping_mode
spot_interest_info
has_stock_occupied
```

`data[].skus[]` 是 SKU 列表。SKU 级主要字段：

```txt
sku_id
sku_name
sku_img
status
stock_type
warehouse_num
cargo_info
total_stock_num
total_unoccupied_stock_num
total_occupied_stock_num
stock_occupy_infos
support_future_stock
spot_stock_num
future_stock_num
operations[]
forbid_edit
forbid_edit_reason
subscribe_num
has_stock_occupied
```

样本里单个商品最多出现 100 个 SKU，因此插件侧预览和 payload 需要按 SKU 行展开，不能只按商品行计数。

### 建议映射到 extension ingest payload

当前 Layer 1 payload 字段可以这样扩展或填充：

| extension ingest 字段 | 建议来源 | 说明 |
| --- | --- | --- |
| `externalSkuId` | `data[].skus[].sku_id` | SKU 主键。若后续需要商品级档案，另存 `product_id` 到 `raw` 或新增 `externalProductId`。 |
| `title` | `data[].product_name` + `data[].skus[].sku_name` | 建议预览显示 `商品名 / SKU名`，payload 可保留二者原始字段。 |
| `salePrice` | 无 | 库存管理接口不返回价格。需要从商品列表、商品详情或其它价格接口补。 |
| `availableStock` | 优先 `data[].skus[].total_unoccupied_stock_num` | 更接近“可用库存”；商品级可用库存是 `data[].total_unoccupied_stock_num`。 |
| `category` | `data[].category_id` | 当前只有类目 ID，没有类目名。类目名需从商品详情或类目字典补。 |
| `listingStatus` | `data[].status` / `data[].skus[].status` | 样本状态码含义待验证，先保存原始码，不在插件翻译成业务结论。 |
| `sourceUrl` | 当前 tab URL 或接口来源页 | 样本来源页是 `/ffa/g/stock-manage/list`。 |
| `raw` | 商品级 + SKU 级原始字段 | 必须保留 `product_id`、`sku_id`、库存拆分、状态码、tags、operations。 |
| `warnings` | 缺价格、缺类目名、SKU 数过多、接口非 0 code、字段缺失 | 只写采集层风险，不写健康/准入结论。 |

建议 Layer 3 的标准行模型先按 SKU 展开：

```txt
一条 payload row = 一个 product_id + 一个 sku_id
```

这样能处理样本里 99/100 SKU 的商品，并避免商品级库存汇总掩盖 SKU 级库存差异。

## SKU 库存诊断接口

```txt
POST https://fxg.jinritemai.com/stock/manage/sku_stock_diagnose?appid=1&__token=<redacted>&_bid=ffa_goods&_lid=<redacted>
```

### 请求体摘要

```json
{
  "product_id": "3818388858177978472",
  "sku_ids": ["3668752191222018"],
  "appid": 1,
  "__token": "<redacted>",
  "_bid": "ffa_goods",
  "_lid": "<redacted>"
}
```

### 响应结构

```txt
code
msg
log_id
data[]
data[].product_id
data[].sku_id
data[].is_alarming
```

样本只返回：

```json
{
  "product_id": "3818388858177978472",
  "sku_id": "3668752191222018",
  "is_alarming": false
}
```

用途建议：

- 作为 `raw.stockDiagnose` 或采集层 `warnings` 的补充输入。
- 不在插件内把 `is_alarming` 翻译为健康诊断、补货建议或活动报名判断。
- 需要验证是否支持批量 `sku_ids`，以及批量上限、空库存 SKU 是否都需要调用。

## 商机中心 real_time_list

```txt
POST https://fxg.jinritemai.com/api/commop/business_chance_center/clue/common/real_time_list
```

### 请求体摘要

```json
{
  "condition": {
    "sort": {
      "sort_direction": 1,
      "sort_field": "MATCH_DEGREE"
    }
  },
  "clue_type": "",
  "source": "goods_list_business_entry",
  "clue_type_new": 12,
  "page": {
    "page_size": 7,
    "current": 1
  },
  "terminal_type": 0,
  "_lid": "<redacted>"
}
```

### 响应数据路径

顶层：

```txt
code
total
base_resp
data[]
```

关键路径：

```txt
data[].clue_detail.clue_id
data[].clue_detail.name
data[].clue_detail.category_id
data[].clue_detail.category_name
data[].clue_detail.category_path[]
data[].clue_detail.price_min
data[].clue_detail.price_max
data[].clue_detail.product_pic_url
data[].clue_detail.clue_label_list[]
data[].clue_detail.profit_info_list[]
data[].query_clue_card_info
data[].clue_indicator
```

用途判断：

- 这是“机会/商机线索”列表，不是店铺当前商品 SKU 列表。
- 可用于后续活动机会、类目机会、规则/趋势上下文。
- 不建议直接映射到 extension ingest payload 的商品字段。
- 如果后续要做“商品列表页旁边的机会入口”，应作为独立上下文 payload，避免和商品事实混在一起。

## 其它 business_chance_center 接口

### 类目范围

```txt
POST /api/commop/business_chance_center/category/qualified/get
```

响应为类目数组，样本字段：

```txt
id
name
first_name
second_name
third_name
fourth_name
first_cid
second_cid
third_cid
fourth_cid
level
parent_id
is_leaf
enable
industry_status
```

用途：机会中心类目过滤/资格范围。可作为类目字典候选，但不能证明库存接口里的 `category_id` 一定能在这里完整解析。

### 配置

```txt
POST /api/commop/business_chance_center/config/get
```

响应包含：

```txt
source_gray_map
unsatisfied_reason_configs
merchant_recommend_card_satisfied_config
prod_recommend_card_satisfied_config
business_opportunities_unavailable_tip
clue_indicator_max_pt
```

用途：商机中心配置和说明文案。里面有商品推荐条件、店铺条件、原因码说明，但这些属于商机/推荐上下文，不是插件采集层判断。

### 搜索提示

```txt
POST /api/commop/business_chance_center/distribute/search/shading_words/get
```

响应样本是搜索引导词，例如“帮我查韩版女装一周热卖榜”。与商品采集主链路无关。

## 分页与筛选参数

库存管理列表：

- 分页：`page`、`pageSize`、`page_size`。
- 样本：`page=1`、`pageSize=10`、`page_size=10`、响应 `total=20`。
- 下一步验证：真实页面翻页时确认 `page=2` 是否返回后 10 条，是否存在服务端最大 `pageSize`。
- 排序：`sort=0`，含义未知，需要点击页面排序后再录一份 fixture。
- 筛选：本样本没有商品名、状态、库存范围、类目、仓库等筛选参数。需要真实页面筛选操作 fixture。

商机线索：

- 分页：`page.current`、`page.page_size`。
- 排序：`condition.sort.sort_field = MATCH_DEGREE`、`sort_direction = 1`。
- 来源：`source = goods_list_business_entry`。
- 类型：`clue_type_new = 12`。

## 敏感 token / cookie 处理注意事项

- 不提交原始记录文件到 repo。
- 不把 `__token`、`_lid`、`_token`、`sec_user_id`、`sec_subject_uid`、Cookie、JWT、设备身份参数写进源码或文档。
- 文档和测试 fixture 只能保存脱敏 URL、字段结构和少量非敏感样例。
- 插件如果后续调用真实接口，应只在当前商家后台页面上下文中发起请求，依赖浏览器当前会话，不复制 Cookie。
- extension ingest payload 只保存采集事实，不保存请求头、Cookie、token、SSO 信息。
- 对 `ecuser.zijieapi.com/ecom/gov/user/gen-did`、`ecomauth/loginv1/select_sso` 这类身份接口只做排除记录，不进入采集模块。

## 仍需真实页面 fixture 验证的点

1. `/stock/manage/list` 的筛选参数：商品名称、商品状态、库存类型、类目、仓库、库存告警等页面操作会产生哪些请求体字段。
2. `/stock/manage/list` 的排序参数：`sort=0` 以外的含义和字段映射。
3. 分页稳定性：`pageSize` 与 `page_size` 是否必须同时传，最大 page size 是多少，翻页过程中 token 是否刷新。
4. 状态码字典：`status`、`draft_status`、`check_status`、`stock_type`、`shipping_mode`、`has_stock_occupied` 的业务含义。
5. 价格来源：库存管理接口没有价格字段，需要另录商品列表或商品详情价格接口。
6. 类目名称来源：库存接口只有 `category_id`，需要确认类目字典接口或商品详情字段。
7. SKU 诊断批量能力：`sku_stock_diagnose` 是否支持一次传多个 SKU、是否需要逐商品调用、频率限制如何。
8. 多 SKU 展开策略：样本最多 100 SKU，side panel 预览需要验证滚动、分页、异常字段聚合。
9. 真实抖店 fixture 替换：当前 Layer 1 synthetic fixture 必须在 Layer 3 前替换成脱敏真实响应 fixture。

## Layer 3 实现建议

- Adapter 命名建议：`DoudianStockManageAdapter`，职责只覆盖库存管理列表与 SKU 库存诊断。
- 主采集步骤：
  1. 从当前 tab 判断是否是 `/ffa/g/stock-manage/list`。
  2. 用当前页面会话发起 `/stock/manage/list`，按 `page/pageSize` 循环。
  3. 将 `data[].skus[]` 展开为 SKU 行。
  4. 可选调用 `/stock/manage/sku_stock_diagnose` 补充 `is_alarming`。
  5. 生成 `extension-ingest.v1` payload，保留 raw 字段。
- 插件展示只显示采集事实、字段映射、分页状态、缺失价格/类目名等采集层风险。
- 商品健康、活动准入、补货建议、正式 Review 决策仍交给后端和总控制台。
