/** Activity Simulation Result响应对象 */
export interface ActivitySimulationResultResponseDto {
  /** 主键 */
  id: string;

  /** 模拟运行 ID */
  simulationRunId: string;

  /** 活动规则集 ID */
  activityRuleSetId: string;

  /** SKU 档案 ID */
  skuProfileId: string;

  /** 关联采集快照 ID */
  snapshotId: string | null;

  /** 关联健康诊断 ID */
  diagnosisId: string | null;

  /** 活动上下文准入状态 */
  eligibilityStatus: string;

  /** 准入评分，0 到 100 */
  eligibilityScore: number | null;

  /** 未通过规则 JSON */
  failedRulesJson: Record<string, unknown>;

  /** 修复计划 JSON */
  repairPlanJson: Record<string, unknown>;

  /** 人工 Review 信息 JSON */
  manualReviewJson: Record<string, unknown>;

  /** 证据链 JSON */
  evidenceJson: Record<string, unknown>;

  /** 创建时间 */
  createdAt: string;
}
