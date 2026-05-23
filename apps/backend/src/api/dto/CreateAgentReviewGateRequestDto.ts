/** 创建Agent Review Gate请求 */
export interface CreateAgentReviewGateRequestDto {
  /** Agent Mission ID */
  missionId: string;

  /** Agent Run ID */
  runId: string;

  /** Agent ToolCall ID */
  toolCallId?: string | null;

  /** 关联 ReviewItem ID */
  reviewItemId?: string | null;

  /** Review Gate 状态 */
  status?: string;

  /** Review Gate 原因编码 */
  reasonCode: string;

  /** 需要人工确认的问题 */
  question: string;

  /** Agent 建议 */
  agentRecommendation?: string | null;

  /** 批准后的风险说明 */
  riskIfApproved?: string | null;

  /** 拒绝后的风险说明 */
  riskIfRejected?: string | null;

  /** 证据引用 JSON */
  evidenceRefsJson?: Record<string, unknown>;

  /** 人工决策 */
  decision?: string | null;

  /** 人工决策说明 */
  decisionComment?: string | null;

  /** 决策人 */
  decidedBy?: string | null;

  /** 决策时间 */
  decidedAt?: string | null;
}
