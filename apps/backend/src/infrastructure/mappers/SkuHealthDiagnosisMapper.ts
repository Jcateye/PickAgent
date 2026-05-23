import type { SkuHealthDiagnosis } from "../../domain/entities/SkuHealthDiagnosis";
import type { SkuHealthDiagnosisRecord } from "../persistence/SkuHealthDiagnosisRecord";
import type { SkuHealthDiagnosisResponseDto } from "../../api/dto/SkuHealthDiagnosisResponseDto";

/** SKU 日常健康诊断结论表映射器 */
export const SkuHealthDiagnosisMapper = {
  toEntity(record: SkuHealthDiagnosisRecord): SkuHealthDiagnosis {
    return {
      id: record.id,
      skuProfileId: record.sku_profile_id,
      snapshotId: record.snapshot_id,
      healthStatus: record.health_status,
      healthScore: record.health_score,
      dataQualityScore: record.data_quality_score,
      issuesJson: record.issues_json,
      nextActionsJson: record.next_actions_json,
      evidenceJson: record.evidence_json,
      diagnosedAt: record.diagnosed_at,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: SkuHealthDiagnosis): SkuHealthDiagnosisResponseDto {
    return {
      id: entity.id,
      skuProfileId: entity.skuProfileId,
      snapshotId: entity.snapshotId,
      healthStatus: entity.healthStatus,
      healthScore: entity.healthScore,
      dataQualityScore: entity.dataQualityScore,
      issuesJson: entity.issuesJson,
      nextActionsJson: entity.nextActionsJson,
      evidenceJson: entity.evidenceJson,
      diagnosedAt: entity.diagnosedAt,
      createdAt: entity.createdAt,
    };
  },
};
