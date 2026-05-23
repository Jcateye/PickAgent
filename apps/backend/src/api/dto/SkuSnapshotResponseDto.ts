/** SKU Snapshot响应对象 */
export interface SkuSnapshotResponseDto {
  /** 主键 */
  id: string;

  /** SKU 档案 ID */
  skuProfileId: string;

  /** 连接器 ID */
  connectorId: string | null;

  /** 来源页面 URL */
  sourceUrl: string | null;

  /** 来源行号 */
  rowIndex: number | null;

  /** 采集时间 */
  collectedAt: string;

  /** 商品名称快照 */
  productName: string | null;

  /** 商品类目快照 */
  category: string | null;

  /** 近 30 天销量 */
  sales30d: number | null;

  /** 好评率，取值范围 0 到 1 */
  positiveRate: string | null;

  /** 可售库存 */
  stock: number | null;

  /** 原价 */
  originalPrice: string | null;

  /** 近 30 天最低价 */
  lowestPrice30d: string | null;

  /** 活动价 */
  campaignPrice: string | null;

  /** 是否已参加品牌日等互斥活动 */
  joinedBrandDay: boolean | null;

  /** 证书状态 */
  certificateStatus: string | null;

  /** 原始采集数据 */
  rawJson: Record<string, unknown>;

  /** 标准化后的字段数据 */
  normalizedJson: Record<string, unknown>;

  /** 创建时间 */
  createdAt: string;
}
