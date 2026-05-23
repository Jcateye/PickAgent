/** 活动规则集表，保存规则原文、Rule DSL 和解析元数据（存储模型） */
export interface ActivityRuleSetRecord {
  /** 主键 */
  id: string;

  /** 活动规则集名称 */
  name: string;

  /** 适用平台 */
  platform: string | null;

  /** 规则原文 */
  source_text: string;

  /** Canonical Rule DSL JSON */
  rules_json: Record<string, unknown>;

  /** 规则解析模型 */
  parse_model: string | null;

  /** 规则解析置信度，取值范围 0 到 1 */
  parse_confidence: string | null;

  /** 规则解析状态 */
  parse_status: string;

  /** 规则解析元数据 JSON */
  parse_metadata_json: Record<string, unknown>;

  /** 创建人 */
  created_by: string | null;

  /** 创建时间 */
  created_at: string;

  /** 更新时间 */
  updated_at: string;
}
