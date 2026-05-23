import type { RawProductRow } from "../../schemas/ingest"

export interface RawCommentRow {
  readonly rowIndex: number
  readonly source: Record<string, unknown>
}

export interface SyntheticDoudianPage {
  readonly url: string
  readonly title: string
  readonly platform: string
  readonly pageType?: "product-list" | "comment-list"
  readonly pageIndex: number
  readonly totalPages: number
  readonly selectors: readonly string[]
  readonly rows: readonly RawProductRow[]
}

export interface SyntheticDoudianCommentPage {
  readonly url: string
  readonly title: string
  readonly platform: string
  readonly pageType: "comment-list"
  readonly pageIndex: number
  readonly totalPages: number
  readonly selectors: readonly string[]
  readonly rows: readonly RawCommentRow[]
}

export const syntheticDoudianPages: readonly SyntheticDoudianPage[] = [
  {
    url: "https://fxg.jinritemai.com/ffa/g/list?page=1",
    title: "抖店商品 - 商品管理",
    platform: "抖店商家后台",
    pageType: "product-list",
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
          "商品状态": "在售",
          "活动标签": ["618预热", "达人可推"],
          "更新时间": "2026-05-23T09:10:00+08:00"
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
          "商品状态": "下架",
          "活动标签": ["库存不足"],
          "更新时间": "2026-05-22T16:30:00+08:00"
        }
      }
    ]
  },
  {
    url: "https://fxg.jinritemai.com/ffa/g/list?page=2",
    title: "抖店商品 - 商品管理",
    platform: "抖店商家后台",
    pageType: "product-list",
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
          "商品状态": "在售",
          "活动标签": ["好评商品"],
          "更新时间": "2026-05-21T11:00:00+08:00"
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
          "商品状态": "在售",
          "活动标签": [],
          "更新时间": "2026-05-20T18:05:00+08:00"
        }
      }
    ]
  },
  {
    url: "https://fxg.jinritemai.com/ffa/g/list?page=3",
    title: "抖店商品 - 商品管理",
    platform: "抖店商家后台",
    pageType: "product-list",
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
          "商品状态": "在售",
          "活动标签": ["价格待补"],
          "更新时间": "2026-05-19T13:20:00+08:00"
        }
      }
    ]
  }
]

export const syntheticDoudianCommentPages: readonly SyntheticDoudianCommentPage[] = [
  {
    url: "https://fxg.jinritemai.com/ffa/maftersale/comment?page=1",
    title: "抖店售后 - 评价管理",
    platform: "抖店商家后台",
    pageType: "comment-list",
    pageIndex: 1,
    totalPages: 2,
    selectors: ["table.doudian-comment-list", "[data-e2e='comment-row']", ".pagination-next"],
    rows: [
      {
        rowIndex: 1,
        source: {
          "评论ID": "CMT-90001",
          "商品ID": "DD-10001",
          "SKU ID": "DD-10001-SKU-A",
          "评分": 5,
          "评论内容": "珍珠光泽很好，包装也完整。",
          "评论时间": "2026-05-23T10:12:00+08:00",
          "图片数": 2,
          "视频数": 0,
          "售后相关": false,
          "追评": false,
          "回复状态": "已回复"
        }
      },
      {
        rowIndex: 2,
        source: {
          "评论ID": "CMT-90002",
          "商品ID": "DD-10002",
          "SKU ID": "DD-10002-SKU-B",
          "评分": 2,
          "评论内容": "物流慢，手链扣有点松。",
          "评论时间": "2026-05-23T09:44:00+08:00",
          "图片数": 1,
          "视频数": 0,
          "售后相关": true,
          "追评": false,
          "回复状态": "未回复"
        }
      }
    ]
  },
  {
    url: "https://fxg.jinritemai.com/ffa/maftersale/comment?page=2",
    title: "抖店售后 - 评价管理",
    platform: "抖店商家后台",
    pageType: "comment-list",
    pageIndex: 2,
    totalPages: 2,
    selectors: ["table.doudian-comment-list", "[data-e2e='comment-row']", ".pagination-disabled-next"],
    rows: [
      {
        rowIndex: 1,
        source: {
          "评论ID": "CMT-90003",
          "商品ID": "DD-10003",
          "SKU ID": "",
          "评分": 3,
          "评论内容": "项链不错，但盒子压坏了。",
          "评论时间": "2026-05-22T20:00:00+08:00",
          "图片数": 0,
          "视频数": 0,
          "售后相关": false,
          "追评": true,
          "回复状态": "未回复"
        }
      }
    ]
  }
]

export const emptySyntheticDoudianCommentPage: SyntheticDoudianCommentPage = {
  url: "https://fxg.jinritemai.com/ffa/maftersale/comment?page=3",
  title: "抖店售后 - 评价管理",
  platform: "抖店商家后台",
  pageType: "comment-list",
  pageIndex: 3,
  totalPages: 3,
  selectors: ["table.doudian-comment-list", ".pagination-disabled-next"],
  rows: []
}

export const unsupportedSyntheticPage: SyntheticDoudianPage = {
  url: "https://fxg.jinritemai.com/ffa/order/list",
  title: "抖店订单 - 订单管理",
  platform: "抖店商家后台",
  pageType: "product-list",
  pageIndex: 1,
  totalPages: 1,
  selectors: ["table.order-list"],
  rows: []
}
