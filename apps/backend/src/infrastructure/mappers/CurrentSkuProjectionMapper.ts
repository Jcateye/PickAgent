import type { CurrentSkuProjection } from "../../domain/entities/CurrentSkuProjection";
import type { CurrentSkuProjectionRecord } from "../persistence/CurrentSkuProjectionRecord";
import type { CurrentSkuProjectionResponseDto } from "../../api/dto/CurrentSkuProjectionResponseDto";

/** SKU 当前状态读模型表，供 Dashboard、SKU List、Chat summary 和 Report summary 查询映射器 */
export const CurrentSkuProjectionMapper = {
  toEntity(record: CurrentSkuProjectionRecord): CurrentSkuProjection {
    return {
      skuProfileId: record.sku_profile_id,
      latestSnapshotId: record.latest_snapshot_id,
      latestDiagnosisId: record.latest_diagnosis_id,
      healthStatus: record.health_status,
      healthScore: record.health_score,
      dataQualityScore: record.data_quality_score,
      topIssuesJson: record.top_issues_json,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: CurrentSkuProjection): CurrentSkuProjectionResponseDto {
    return {
      skuProfileId: entity.skuProfileId,
      latestSnapshotId: entity.latestSnapshotId,
      latestDiagnosisId: entity.latestDiagnosisId,
      healthStatus: entity.healthStatus,
      healthScore: entity.healthScore,
      dataQualityScore: entity.dataQualityScore,
      topIssuesJson: entity.topIssuesJson,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
