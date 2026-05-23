/** 创建SKU Health Diagnosis请求 */
export interface CreateSkuHealthDiagnosisRequestDto {
  /** SKU 档案 ID */
  skuProfileId: string;

  /** 关联采集快照 ID */
  snapshotId?: string | null;

  /** 长期健康状态 */
  healthStatus: string;

  /** 健康分，0 到 100 */
  healthScore: number;

  /** 数据质量分，0 到 100 */
  dataQualityScore: number;

  /** 问题列表 JSON */
  issuesJson?: Record<string, unknown>;

  /** 下一步动作 JSON */
  nextActionsJson?: Record<string, unknown>;

  /** 证据链 JSON */
  evidenceJson?: Record<string, unknown>;

  /** 诊断时间 */
  diagnosedAt?: string;
}
