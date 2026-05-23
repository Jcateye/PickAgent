import type { AgentContextSnapshot } from "../../domain/entities/AgentContextSnapshot";
import type { AgentContextSnapshotRecord } from "../persistence/AgentContextSnapshotRecord";
import type { AgentContextSnapshotResponseDto } from "../../api/dto/AgentContextSnapshotResponseDto";

/** Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要映射器 */
export const AgentContextSnapshotMapper = {
  toEntity(record: AgentContextSnapshotRecord): AgentContextSnapshot {
    return {
      id: record.id,
      runId: record.run_id,
      workbenchContextJson: record.workbench_context_json,
      stableContextJson: record.stable_context_json,
      missionContextJson: record.mission_context_json,
      evidenceSummaryJson: record.evidence_summary_json,
      tokenEstimate: record.token_estimate,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: AgentContextSnapshot): AgentContextSnapshotResponseDto {
    return {
      id: entity.id,
      runId: entity.runId,
      workbenchContextJson: entity.workbenchContextJson,
      stableContextJson: entity.stableContextJson,
      missionContextJson: entity.missionContextJson,
      evidenceSummaryJson: entity.evidenceSummaryJson,
      tokenEstimate: entity.tokenEstimate,
      createdAt: entity.createdAt,
    };
  },
};
