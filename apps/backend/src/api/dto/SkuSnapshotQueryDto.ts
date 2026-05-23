/** SKU Snapshot列表查询条件 */
export interface SkuSnapshotQueryDto {
  /** 主键 */
  id?: string;

  /** SKU 档案 ID */
  skuProfileId?: string;

  /** 连接器 ID */
  connectorId?: string | null;

  /** 采集时间 */
  collectedAt?: string;

  /** 商品名称快照 */
  productName?: string | null;

  /** 商品类目快照 */
  category?: string | null;

  /** 近 30 天销量 */
  sales30d?: number | null;

  /** 好评率，取值范围 0 到 1 */
  positiveRate?: string | null;

  /** 可售库存 */
  stock?: number | null;

  /** 是否已参加品牌日等互斥活动 */
  joinedBrandDay?: boolean | null;

  /** 证书状态 */
  certificateStatus?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "skuProfileId" | "connectorId" | "rowIndex" | "collectedAt" | "productName" | "category" | "sales30d" | "positiveRate" | "stock" | "originalPrice" | "lowestPrice30d" | "campaignPrice" | "joinedBrandDay" | "certificateStatus" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
