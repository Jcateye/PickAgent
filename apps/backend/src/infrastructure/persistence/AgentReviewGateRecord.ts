/** Agent Review Gate 表，保存 Agent 运行时暂停点、人工确认问题、建议、风险和决策（存储模型） */
export interface AgentReviewGateRecord {
  /** 主键 */
  id: string;

  /** Agent Mission ID */
  mission_id: string;

  /** Agent Run ID */
  run_id: string;

  /** Agent ToolCall ID */
  tool_call_id: string | null;

  /** 关联 ReviewItem ID */
  review_item_id: string | null;

  /** Review Gate 状态 */
  status: string;

  /** Review Gate 原因编码 */
  reason_code: string;

  /** 需要人工确认的问题 */
  question: string;

  /** Agent 建议 */
  agent_recommendation: string | null;

  /** 批准后的风险说明 */
  risk_if_approved: string | null;

  /** 拒绝后的风险说明 */
  risk_if_rejected: string | null;

  /** 证据引用 JSON */
  evidence_refs_json: Record<string, unknown>;

  /** 人工决策 */
  decision: string | null;

  /** 人工决策说明 */
  decision_comment: string | null;

  /** 决策人 */
  decided_by: string | null;

  /** 决策时间 */
  decided_at: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
