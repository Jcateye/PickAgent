/** Connector列表查询条件 */
export interface ConnectorQueryDto {
  /** 主键 */
  id?: string;

  /** 连接器编码 */
  code?: string;

  /** 连接器名称 */
  name?: string;

  /** 连接器类型 */
  kind?: string;

  /** 电商平台标识 */
  platform?: string | null;

  /** 连接器状态 */
  status?: string;

  /** 页码 */
  page?: number;

  /** 每页数量 */
  pageSize?: number;

  /** 排序字段 */
  sortBy?: "id" | "code" | "name" | "kind" | "platform" | "status" | "createdAt" | "updatedAt";

  /** 排序方向 */
  sortOrder?: "asc" | "desc";
}
