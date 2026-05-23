import type { ReviewItem } from "../../domain/entities/ReviewItem";
import type { ReviewItemRecord } from "../persistence/ReviewItemRecord";
import type { ReviewItemResponseDto } from "../../api/dto/ReviewItemResponseDto";

/** 人工 Review 审批任务表映射器 */
export const ReviewItemMapper = {
  toEntity(record: ReviewItemRecord): ReviewItem {
    return {
      id: record.id,
      skuProfileId: record.sku_profile_id,
      snapshotId: record.snapshot_id,
      diagnosisId: record.diagnosis_id,
      activityRuleSetId: record.activity_rule_set_id,
      simulationResultId: record.simulation_result_id,
      reviewType: record.review_type,
      reasonCode: record.reason_code,
      status: record.status,
      question: record.question,
      agentRecommendation: record.agent_recommendation,
      riskLevel: record.risk_level,
      decision: record.decision,
      decisionComment: record.decision_comment,
      decisionBy: record.decision_by,
      decidedAt: record.decided_at,
      evidenceJson: record.evidence_json,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: ReviewItem): ReviewItemResponseDto {
    return {
      id: entity.id,
      skuProfileId: entity.skuProfileId,
      snapshotId: entity.snapshotId,
      diagnosisId: entity.diagnosisId,
      activityRuleSetId: entity.activityRuleSetId,
      simulationResultId: entity.simulationResultId,
      reviewType: entity.reviewType,
      reasonCode: entity.reasonCode,
      status: entity.status,
      question: entity.question,
      agentRecommendation: entity.agentRecommendation,
      riskLevel: entity.riskLevel,
      decision: entity.decision,
      decisionComment: entity.decisionComment,
      decisionBy: entity.decisionBy,
      decidedAt: entity.decidedAt,
      evidenceJson: entity.evidenceJson,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
