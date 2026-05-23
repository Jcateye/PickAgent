import type { IngestPayloadDto } from "./businessFoundation";

export const businessFoundationSeedFixture: IngestPayloadDto = {
  connectorId: "connector_tmall_demo",
  collectedAt: "2026-05-23T10:00:00.000Z",
  rows: [
    {
      platform: "tmall",
      storeId: "store_demo",
      externalSkuId: "sku_ready_001",
      productName: "轻量保温杯 500ml",
      category: "home",
      brand: "PickAgent Demo",
      sourceUrl: "https://example.test/products",
      rowIndex: 1,
      sales30d: 230,
      positiveRate: 0.97,
      stock: 120,
      originalPrice: 99,
      lowestPrice30d: 79,
      campaignPrice: 69,
      joinedBrandDay: false,
      certificateStatus: "valid",
      raw: { title: "轻量保温杯 500ml", stockText: "120", certificate: "valid" },
    },
    {
      platform: "tmall",
      storeId: "store_demo",
      externalSkuId: "sku_repair_002",
      productName: "旅行收纳包",
      category: "travel",
      brand: "PickAgent Demo",
      sourceUrl: "https://example.test/products",
      rowIndex: 2,
      sales30d: 54,
      positiveRate: 0.9,
      stock: 8,
      originalPrice: 59,
      lowestPrice30d: 49,
      campaignPrice: 39,
      joinedBrandDay: false,
      certificateStatus: "valid",
      raw: { title: "旅行收纳包", stockText: "8", certificate: "valid" },
    },
  ],
};

export const businessFoundationActivityRuleText = "活动库存不少于 20，好评率不少于 92%，证书状态必须有效。";
