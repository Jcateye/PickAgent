import type { AgentContextLink } from "../../domain/entities/AgentContextLink";
import type { AgentContextLinkRecord } from "../persistence/AgentContextLinkRecord";
import type { AgentContextLinkResponseDto } from "../../api/dto/AgentContextLinkResponseDto";

/** Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照映射器 */
export const AgentContextLinkMapper = {
  toEntity(record: AgentContextLinkRecord): AgentContextLink {
    return {
      id: record.id,
      missionId: record.mission_id,
      runId: record.run_id,
      sourceType: record.source_type,
      sourceId: record.source_id,
      entityType: record.entity_type,
      entityId: record.entity_id,
      label: record.label,
      reason: record.reason,
      highlightJson: record.highlight_json,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: AgentContextLink): AgentContextLinkResponseDto {
    return {
      id: entity.id,
      missionId: entity.missionId,
      runId: entity.runId,
      sourceType: entity.sourceType,
      sourceId: entity.sourceId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      label: entity.label,
      reason: entity.reason,
      highlightJson: entity.highlightJson,
      createdAt: entity.createdAt,
    };
  },
};
