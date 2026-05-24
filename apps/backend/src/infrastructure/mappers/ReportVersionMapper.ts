import type { ReportVersion } from "../../domain/entities/ReportVersion";
import type { ReportVersionRecord } from "../persistence/ReportVersionRecord";
import type { ReportVersionResponseDto } from "../../api/dto/ReportVersionResponseDto";

/** 报告版本表，保存报告章节、证据快照和导出产物引用映射器 */
export const ReportVersionMapper = {
  toEntity(record: ReportVersionRecord): ReportVersion {
    return {
      id: record.id,
      reportId: record.report_id,
      version: record.version,
      status: record.status,
      sectionsJson: record.sections_json,
      evidenceRefsJson: record.evidence_refs_json,
      exportArtifactsJson: record.export_artifacts_json,
      createdBy: record.created_by,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: ReportVersion): ReportVersionResponseDto {
    return {
      id: entity.id,
      reportId: entity.reportId,
      version: entity.version,
      status: entity.status,
      sectionsJson: entity.sectionsJson,
      evidenceRefsJson: entity.evidenceRefsJson,
      exportArtifactsJson: entity.exportArtifactsJson,
      createdBy: entity.createdBy,
      createdAt: entity.createdAt,
    };
  },
};
