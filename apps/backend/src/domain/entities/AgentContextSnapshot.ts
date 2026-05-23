/** Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要（领域模型） */
export interface AgentContextSnapshot {
  /** 主键 */
  id: string;

  /** Agent Run ID */
  runId: string;

  /** 工作台上下文 JSON */
  workbenchContextJson: Record<string, unknown>;

  /** 稳定系统上下文 JSON */
  stableContextJson: Record<string, unknown>;

  /** Mission 上下文 JSON */
  missionContextJson: Record<string, unknown>;

  /** 证据摘要 JSON */
  evidenceSummaryJson: Record<string, unknown>;

  /** 上下文 token 估算 */
  tokenEstimate: number | null;

  /** 创建时间 */
  createdAt: string;
}
