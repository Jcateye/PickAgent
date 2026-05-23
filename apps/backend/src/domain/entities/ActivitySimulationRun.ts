/** 活动准入模拟运行表（领域模型） */
export interface ActivitySimulationRun {
  /** 主键 */
  id: string;

  /** 活动规则集 ID */
  activityRuleSetId: string;

  /** 模拟范围 JSON */
  scopeJson: Record<string, unknown>;

  /** 运行状态 */
  status: string;

  /** 模拟摘要 JSON */
  summaryJson: Record<string, unknown>;

  /** 运行人 */
  runBy: string | null;

  /** 开始时间 */
  startedAt: string | null;

  /** 完成时间 */
  completedAt: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
