/** Activity Rule Set列表查询条件 */
export interface ActivityRuleSetQueryDto {
  /** 主键 */
  id?: string;

  /** 活动规则集名称 */
  name?: string;

  /** 适用平台 */
  platform?: string | null;

  /** 规则解析模型 */
  parseModel?: string | null;

  /** 规则解析状态 */
  parseStatus?: string;

  /** 创建人 */
  createdBy?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "name" | "platform" | "parseModel" | "parseConfidence" | "parseStatus" | "createdBy" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
