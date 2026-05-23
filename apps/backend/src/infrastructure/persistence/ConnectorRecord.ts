/** 数据连接器表，记录插件、平台 API、报表导入等采集来源（存储模型） */
export interface ConnectorRecord {
  /** 主键 */
  id: string;

  /** 连接器编码 */
  code: string;

  /** 连接器名称 */
  name: string;

  /** 连接器类型 */
  kind: string;

  /** 电商平台标识 */
  platform: string | null;

  /** 连接器配置 JSON */
  config_json: Record<string, unknown>;

  /** 连接器状态 */
  status: string;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
