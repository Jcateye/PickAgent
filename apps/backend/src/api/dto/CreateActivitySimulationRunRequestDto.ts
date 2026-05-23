/** 创建Activity Simulation Run请求 */
export interface CreateActivitySimulationRunRequestDto {
  /** 活动规则集 ID */
  activityRuleSetId: string;

  /** 模拟范围 JSON */
  scopeJson?: Record<string, unknown>;

  /** 运行状态 */
  status?: string;

  /** 模拟摘要 JSON */
  summaryJson?: Record<string, unknown>;

  /** 运行人 */
  runBy?: string | null;

  /** 开始时间 */
  startedAt?: string | null;

  /** 完成时间 */
  completedAt?: string | null;
}
