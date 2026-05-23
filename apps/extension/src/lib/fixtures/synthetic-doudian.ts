import type { RawProductRow } from "../../schemas/ingest"

export interface SyntheticDoudianPage {
  readonly url: string
  readonly title: string
  readonly platform: string
  readonly pageIndex: number
  readonly totalPages: number
  readonly selectors: readonly string[]
  readonly rows: readonly RawProductRow[]
}

export const syntheticDoudianPages: readonly SyntheticDoudianPage[] = [
  {
    url: "https://fxg.jinritemai.com/ffa/g/list?page=1",
    title: "抖店商品 - 商品管理",
    platform: "抖店商家后台",
    pageIndex: 1,
    totalPages: 3,
    selectors: ["table.doudian-product-list", "[data-e2e='product-row']", ".pagination-next"],
    rows: [
      {
        rowIndex: 1,
        source: {
          "商品ID": "DD-10001",
          "商品标题": "18K 金珍珠耳钉",
          "到手价": 399,
          "可售库存": 36,
          "类目": "珠宝饰品/耳饰",
          "商品状态": "在售"
        }
      },
      {
        rowIndex: 2,
        source: {
          "商品ID": "DD-10002",
          "商品标题": "足金转运珠手链",
          "到手价": 688,
          "可售库存": 0,
          "类目": "珠宝饰品/手链",
          "商品状态": "下架"
        }
      }
    ]
  },
  {
    url: "https://fxg.jinritemai.com/ffa/g/list?page=2",
    title: "抖店商品 - 商品管理",
    platform: "抖店商家后台",
    pageIndex: 2,
    totalPages: 3,
    selectors: ["table.doudian-product-list", "[data-e2e='product-row']", ".pagination-next"],
    rows: [
      {
        rowIndex: 1,
        source: {
          "商品ID": "DD-10003",
          "商品标题": "天然淡水珍珠项链",
          "到手价": 529,
          "可售库存": 18,
          "类目": "珠宝饰品/项链",
          "商品状态": "在售"
        }
      },
      {
        rowIndex: 2,
        source: {
          "商品ID": "",
          "商品标题": "银镀金锆石戒指",
          "到手价": 129,
          "可售库存": 42,
          "类目": "珠宝饰品/戒指",
          "商品状态": "在售"
        }
      }
    ]
  },
  {
    url: "https://fxg.jinritemai.com/ffa/g/list?page=3",
    title: "抖店商品 - 商品管理",
    platform: "抖店商家后台",
    pageIndex: 3,
    totalPages: 3,
    selectors: ["table.doudian-product-list", "[data-e2e='product-row']", ".pagination-disabled-next"],
    rows: [
      {
        rowIndex: 1,
        source: {
          "商品ID": "DD-10005",
          "商品标题": "和田玉平安扣吊坠",
          "到手价": null,
          "可售库存": 12,
          "类目": "珠宝饰品/吊坠",
          "商品状态": "在售"
        }
      }
    ]
  }
]

export const unsupportedSyntheticPage: SyntheticDoudianPage = {
  url: "https://fxg.jinritemai.com/ffa/order/list",
  title: "抖店订单 - 订单管理",
  platform: "抖店商家后台",
  pageIndex: 1,
  totalPages: 1,
  selectors: ["table.order-list"],
  rows: []
}
