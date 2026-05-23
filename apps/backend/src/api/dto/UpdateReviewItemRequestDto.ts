/** 更新Review Item请求 */
export interface UpdateReviewItemRequestDto {
  /** SKU 档案 ID */
  skuProfileId?: string | null;

  /** 采集快照 ID */
  snapshotId?: string | null;

  /** 健康诊断 ID */
  diagnosisId?: string | null;

  /** 活动规则集 ID */
  activityRuleSetId?: string | null;

  /** 活动模拟结果 ID */
  simulationResultId?: string | null;

  /** Review 类型 */
  reviewType?: string;

  /** Review 原因编码 */
  reasonCode?: string;

  /** Review 状态 */
  status?: string;

  /** 需要人工回答的问题 */
  question?: string;

  /** Agent 建议 */
  agentRecommendation?: string | null;

  /** 风险等级 */
  riskLevel?: string | null;

  /** 人工决策 */
  decision?: string | null;

  /** 人工决策说明 */
  decisionComment?: string | null;

  /** 决策人 */
  decisionBy?: string | null;

  /** 决策时间 */
  decidedAt?: string | null;

  /** 证据链 JSON */
  evidenceJson?: Record<string, unknown>;
}
