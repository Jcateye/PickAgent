/** WorkspaceSetting列表查询条件 */
export interface WorkspaceSettingQueryDto {
  /** 主键 */
  id?: string;

  /** 设置命名空间 */
  namespace?: string;

  /** 设置键 */
  settingKey?: string;

  /** 设置状态 */
  status?: string;

  /** 更新人 */
  updatedBy?: string | null;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "namespace" | "settingKey" | "status" | "updatedBy" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
