/** 工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置（领域模型） */
export interface WorkspaceSetting {
  /** 主键 */
  id: string;

  /** 设置命名空间 */
  namespace: string;

  /** 设置键 */
  settingKey: string;

  /** 设置值 JSON */
  settingJson: Record<string, unknown>;

  /** 设置状态 */
  status: string;

  /** 更新人 */
  updatedBy: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
