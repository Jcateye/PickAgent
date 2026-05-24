/** ReportVersion列表查询条件 */
export interface ReportVersionQueryDto {
  /** 主键 */
  id?: string;

  /** 报告 ID */
  reportId?: string;

  /** 版本号 */
  version?: number;

  /** 版本状态 */
  status?: string;

  /** 创建人 */
  createdBy?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "version" | "status" | "createdBy" | "createdAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
