import type { DoudianStockDiagnoseResponse, DoudianStockListResponse } from "../ingest/doudian-http-adapter"

export const realDoudianStockListFixture: DoudianStockListResponse = {
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
