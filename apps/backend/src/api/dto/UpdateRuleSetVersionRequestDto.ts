/** 更新RuleSetVersion请求 */
export interface UpdateRuleSetVersionRequestDto {
  /** 活动规则集 ID */
  ruleSetId?: string;

  /** 版本号 */
  version?: number;

  /** 版本状态 */
  status?: string;

  /** 规则原文快照 */
  sourceText?: string;

  /** Canonical Rule DSL JSON 快照 */
  rulesJson?: Record<string, unknown>;

  /** 必需字段 JSON */
  requiredFieldsJson?: Record<string, unknown>;

  /** 人工确认项 JSON */
  confirmationsJson?: Record<string, unknown>;

  /** 版本元数据 JSON */
  metadataJson?: Record<string, unknown>;

  /** 创建人 */
  createdBy?: string | null;
}
