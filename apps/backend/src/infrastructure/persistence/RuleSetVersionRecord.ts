/** 规则库版本表，保存规则集历史版本、Rule DSL 快照和发布状态（存储模型） */
export interface RuleSetVersionRecord {
  /** 主键 */
  id: string;

  /** 活动规则集 ID */
  rule_set_id: string;

  /** 版本号 */
  version: number;

  /** 版本状态 */
  status: string;

  /** 规则原文快照 */
  source_text: string;

  /** Canonical Rule DSL JSON 快照 */
  rules_json: Record<string, unknown>;

  /** 必需字段 JSON */
  required_fields_json: Record<string, unknown>;

  /** 人工确认项 JSON */
  confirmations_json: Record<string, unknown>;

  /** 版本元数据 JSON */
  metadata_json: Record<string, unknown>;

  /** 创建人 */
  created_by: string | null;

  /** 创建时间 */
  created_at: string;
}
