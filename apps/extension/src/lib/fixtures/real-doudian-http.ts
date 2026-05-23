import type { DoudianStockDiagnoseResponse, DoudianStockListResponse } from "../ingest/doudian-http-adapter"

export const realDoudianStockListFirstPageFixture: DoudianStockListResponse = {
  code: 0,
  msg: "success",
  page: 1,
  size: 10,
  total: 20,
  data: [
    {
      product_id: "3818388858177978472",
      product_name: "韩版夏季短袖上衣",
      category_id: 1000003337,
      status: 0,
      draft_status: 0,
      check_status: 3,
      stock_type: 0,
      shipping_mode: 0,
      total_stock_num: 20000,
      total_unoccupied_stock_num: 20000,
      total_occupied_stock_num: 0,
      tags: ["现货"],
      skus: [
        {
          sku_id: "3668752191222018",
          sku_name: "浅蓝色/均码",
          status: 0,
          total_stock_num: 20000,
          total_unoccupied_stock_num: 20000,
          total_occupied_stock_num: 0
        }
      ]
    },
    {
      product_id: "3818388858177978473",
      product_name: "夏季防晒外套",
      category_id: 1000003338,
      status: 0,
      draft_status: 0,
      check_status: 3,
      total_stock_num: 18,
      total_unoccupied_stock_num: 18,
      skus: [
        {
          sku_id: "3668752191222019",
          sku_name: "白色/S",
          status: 0,
          total_stock_num: 10,
          total_unoccupied_stock_num: 10
        },
        {
          sku_id: "3668752191222020",
          sku_name: "白色/M",
          status: 0,
          total_stock_num: 8,
          total_unoccupied_stock_num: 8
        }
      ]
    }
  ]
}

export const realDoudianStockListSecondPageFixture: DoudianStockListResponse = {
  code: 0,
  msg: "success",
  page: 2,
  size: 10,
  total: 20,
  data: [
    {
      product_id: "3813356105610952975",
      product_name: "韩版夏季短袖上衣",
      category_id: 1000003337,
      status: 1,
      draft_status: 0,
      check_status: 3,
      stock_type: 0,
      shipping_mode: 1,
      total_stock_num: 782,
      total_unoccupied_stock_num: 0,
      total_occupied_stock_num: 782,
      tags: ["现货"],
      skus: [
        {
          sku_id: "3657304907025666",
          sku_name: "浅蓝色/均码",
          status: 0,
          total_stock_num: 782,
          total_unoccupied_stock_num: 0,
          total_occupied_stock_num: 782
        }
      ]
    }
  ]
}

export const realDoudianStockListFilteredFixture: DoudianStockListResponse = {
  code: 0,
  msg: "success",
  page: 1,
  size: 10,
  total: 1,
  data: [
    {
      product_id: "3818388858177978472",
      product_name: "韩版夏季短袖上衣",
      category_id: 1000003337,
      status: 0,
      draft_status: 0,
      check_status: 3,
      stock_type: 0,
      shipping_mode: 0,
      total_stock_num: 20000,
      total_unoccupied_stock_num: 20000,
      total_occupied_stock_num: 0,
      tags: ["现货"],
      skus: [
        {
          sku_id: "3668752191222018",
          sku_name: "浅蓝色/均码",
          status: 0,
          total_stock_num: 20000,
          total_unoccupied_stock_num: 20000,
          total_occupied_stock_num: 0
        }
      ]
    }
  ]
}

export const realDoudianStockListFixture = realDoudianStockListFirstPageFixture

export const realDoudianStockDiagnoseFixture: DoudianStockDiagnoseResponse = {
  code: 0,
  msg: "success",
  data: [
    {
      product_id: "3818388858177978472",
      sku_id: "3668752191222018",
      is_alarming: false
    },
    {
      product_id: "3818388858177978473",
      sku_id: "3668752191222019",
      is_alarming: false
    },
    {
      product_id: "3818388858177978473",
      sku_id: "3668752191222020",
      is_alarming: true
    }
  ]
}

export const realDoudianStockListFirstPageRequestFixture = {
  page: 1,
  pageSize: 10,
  page_size: 10,
  sort: 0
} as const

export const realDoudianStockListSecondPageRequestFixture = {
  page: 2,
  pageSize: 10,
  page_size: 10,
  sort: 0
} as const

export const realDoudianStockListFilteredRequestFixture = {
  page: 1,
  pageSize: 10,
  page_size: 10,
  sort: 0,
  product_name: "韩版夏季短袖上衣",
  status: 0,
  stock_type: 0,
  category_id: 1000003337
} as const

export const realDoudianSkuStockDiagnoseRequestFixture = {
  product_id: "3818388858177978473",
  sku_ids: ["3668752191222019", "3668752191222020"]
} as const
