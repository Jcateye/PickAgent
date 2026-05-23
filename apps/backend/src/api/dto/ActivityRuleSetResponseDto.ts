/** Activity Rule Set响应对象 */
export interface ActivityRuleSetResponseDto {
  /** 主键 */
  id: string;

  /** 活动规则集名称 */
  name: string;

  /** 适用平台 */
  platform: string | null;

  /** 规则原文 */
  sourceText: string;

  /** Canonical Rule DSL JSON */
  rulesJson: Record<string, unknown>;

  /** 规则解析模型 */
  parseModel: string | null;

  /** 规则解析置信度，取值范围 0 到 1 */
  parseConfidence: string | null;

  /** 规则解析状态 */
  parseStatus: string;

  /** 规则解析元数据 JSON */
  parseMetadataJson: Record<string, unknown>;

  /** 创建人 */
  createdBy: string | null;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
