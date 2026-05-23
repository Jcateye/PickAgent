import type { ActivitySimulationResult } from "../../domain/entities/ActivitySimulationResult";
import type { ActivitySimulationResultRecord } from "../persistence/ActivitySimulationResultRecord";
import type { ActivitySimulationResultResponseDto } from "../../api/dto/ActivitySimulationResultResponseDto";

/** 单个 SKU 在某次活动模拟中的准入结论表映射器 */
export const ActivitySimulationResultMapper = {
  toEntity(record: ActivitySimulationResultRecord): ActivitySimulationResult {
    return {
      id: record.id,
      simulationRunId: record.simulation_run_id,
      activityRuleSetId: record.activity_rule_set_id,
      skuProfileId: record.sku_profile_id,
      snapshotId: record.snapshot_id,
      diagnosisId: record.diagnosis_id,
      eligibilityStatus: record.eligibility_status,
      eligibilityScore: record.eligibility_score,
      failedRulesJson: record.failed_rules_json,
      repairPlanJson: record.repair_plan_json,
      manualReviewJson: record.manual_review_json,
      evidenceJson: record.evidence_json,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: ActivitySimulationResult): ActivitySimulationResultResponseDto {
    return {
      id: entity.id,
      simulationRunId: entity.simulationRunId,
      activityRuleSetId: entity.activityRuleSetId,
      skuProfileId: entity.skuProfileId,
      snapshotId: entity.snapshotId,
      diagnosisId: entity.diagnosisId,
      eligibilityStatus: entity.eligibilityStatus,
      eligibilityScore: entity.eligibilityScore,
      failedRulesJson: entity.failedRulesJson,
      repairPlanJson: entity.repairPlanJson,
      manualReviewJson: entity.manualReviewJson,
      evidenceJson: entity.evidenceJson,
      createdAt: entity.createdAt,
    };
  },
};
