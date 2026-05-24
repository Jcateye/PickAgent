/** 报告版本表，保存报告章节、证据快照和导出产物引用（存储模型） */
export interface ReportVersionRecord {
  /** 主键 */
  id: string;

  /** 报告 ID */
  report_id: string;

  /** 版本号 */
  version: number;

  /** 版本状态 */
  status: string;

  /** 报告章节 JSON */
  sections_json: Record<string, unknown>;

  /** 证据引用 JSON */
  evidence_refs_json: Record<string, unknown>;

  /** 导出产物 JSON */
  export_artifacts_json: Record<string, unknown>;

  /** 创建人 */
  created_by: string | null;

  /** 创建时间 */
  created_at: string;
}
