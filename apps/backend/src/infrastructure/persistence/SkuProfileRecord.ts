/** 长期 SKU 档案表，承接采集事实、健康结论、活动模拟和 Review（存储模型） */
export interface SkuProfileRecord {
  /** 主键 */
  id: string;

  /** 稳定 SKU 业务键，MVP 采用 platform:store_id:external_sku_id */
  canonical_key: string;

  /** 电商平台标识 */
  platform: string;

  /** 店铺或业务主体 ID */
  store_id: string;

  /** 外部平台 SKU ID */
  external_sku_id: string;

  /** 商品名称 */
  product_name: string | null;

  /** 商品类目 */
  category: string | null;

  /** 品牌 */
  brand: string | null;

  /** SKU 档案状态 */
  status: string;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
