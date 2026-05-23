/** SKU Profile列表查询条件 */
export interface SkuProfileQueryDto {
  /** 主键 */
  id?: string;

  /** 稳定 SKU 业务键，MVP 采用 platform:store_id:external_sku_id */
  canonicalKey?: string;

  /** 电商平台标识 */
  platform?: string;

  /** 店铺或业务主体 ID */
  storeId?: string;

  /** 外部平台 SKU ID */
  externalSkuId?: string;

  /** 商品名称 */
  productName?: string | null;

  /** 商品类目 */
  category?: string | null;

  /** 品牌 */
  brand?: string | null;

  /** SKU 档案状态 */
  status?: string;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "canonicalKey" | "platform" | "storeId" | "externalSkuId" | "productName" | "category" | "brand" | "status" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
