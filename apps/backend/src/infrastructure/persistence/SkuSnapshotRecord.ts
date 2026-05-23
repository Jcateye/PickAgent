/** SKU 采集事实快照表（存储模型） */
export interface SkuSnapshotRecord {
  /** 主键 */
  id: string;

  /** SKU 档案 ID */
  sku_profile_id: string;

  /** 连接器 ID */
  connector_id: string | null;

  /** 来源页面 URL */
  source_url: string | null;

  /** 来源行号 */
  row_index: number | null;

  /** 采集时间 */
  collected_at: string;

  /** 商品名称快照 */
  product_name: string | null;

  /** 商品类目快照 */
  category: string | null;

  /** 近 30 天销量 */
  sales30d: number | null;

  /** 好评率，取值范围 0 到 1 */
  positive_rate: string | null;

  /** 可售库存 */
  stock: number | null;

  /** 原价 */
  original_price: string | null;

  /** 近 30 天最低价 */
  lowest_price_30d: string | null;

  /** 活动价 */
  campaign_price: string | null;

  /** 是否已参加品牌日等互斥活动 */
  joined_brand_day: boolean | null;

  /** 证书状态 */
  certificate_status: string | null;

  /** 原始采集数据 */
  raw_json: Record<string, unknown>;

  /** 标准化后的字段数据 */
  normalized_json: Record<string, unknown>;

  /** 创建时间 */
  created_at: string;
}
