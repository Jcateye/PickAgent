/** 工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置（存储模型） */
export interface WorkspaceSettingRecord {
  /** 主键 */
  id: string;

  /** 设置命名空间 */
  namespace: string;

  /** 设置键 */
  setting_key: string;

  /** 设置值 JSON */
  setting_json: Record<string, unknown>;

  /** 设置状态 */
  status: string;

  /** 更新人 */
  updated_by: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
