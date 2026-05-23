/** Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要（存储模型） */
export interface AgentContextSnapshotRecord {
  /** 主键 */
  id: string;

  /** Agent Run ID */
  run_id: string;

  /** 工作台上下文 JSON */
  workbench_context_json: Record<string, unknown>;

  /** 稳定系统上下文 JSON */
  stable_context_json: Record<string, unknown>;

  /** Mission 上下文 JSON */
  mission_context_json: Record<string, unknown>;

  /** 证据摘要 JSON */
  evidence_summary_json: Record<string, unknown>;

  /** 上下文 token 估算 */
  token_estimate: number | null;

  /** 创建时间 */
  created_at: string;
}
