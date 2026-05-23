import type { AgentReviewGate } from "../../domain/entities/AgentReviewGate";
import type { AgentReviewGateRecord } from "../persistence/AgentReviewGateRecord";
import type { AgentReviewGateResponseDto } from "../../api/dto/AgentReviewGateResponseDto";

/** Agent Review Gate 表，保存 Agent 运行时暂停点、人工确认问题、建议、风险和决策映射器 */
export const AgentReviewGateMapper = {
  toEntity(record: AgentReviewGateRecord): AgentReviewGate {
    return {
      id: record.id,
      missionId: record.mission_id,
      runId: record.run_id,
      toolCallId: record.tool_call_id,
      reviewItemId: record.review_item_id,
      status: record.status,
      reasonCode: record.reason_code,
      question: record.question,
      agentRecommendation: record.agent_recommendation,
      riskIfApproved: record.risk_if_approved,
      riskIfRejected: record.risk_if_rejected,
      evidenceRefsJson: record.evidence_refs_json,
      decision: record.decision,
      decisionComment: record.decision_comment,
      decidedBy: record.decided_by,
      decidedAt: record.decided_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: AgentReviewGate): AgentReviewGateResponseDto {
    return {
      id: entity.id,
      missionId: entity.missionId,
      runId: entity.runId,
      toolCallId: entity.toolCallId,
      reviewItemId: entity.reviewItemId,
      status: entity.status,
      reasonCode: entity.reasonCode,
      question: entity.question,
      agentRecommendation: entity.agentRecommendation,
      riskIfApproved: entity.riskIfApproved,
      riskIfRejected: entity.riskIfRejected,
      evidenceRefsJson: entity.evidenceRefsJson,
      decision: entity.decision,
      decisionComment: entity.decisionComment,
      decidedBy: entity.decidedBy,
      decidedAt: entity.decidedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
