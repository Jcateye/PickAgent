import type { AgentMessage } from "../../domain/entities/AgentMessage";
import type { AgentMessageRecord } from "../persistence/AgentMessageRecord";
import type { AgentMessageResponseDto } from "../../api/dto/AgentMessageResponseDto";

/** Agent 消息表，保存 Copilot 会话消息并支持刷新恢复和历史回看映射器 */
export const AgentMessageMapper = {
  toEntity(record: AgentMessageRecord): AgentMessage {
    return {
      id: record.id,
      sessionId: record.session_id,
      runId: record.run_id,
      role: record.role,
      orderIndex: record.order_index,
      contentText: record.content_text,
      contentJson: record.content_json,
      status: record.status,
      parentId: record.parent_id,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: AgentMessage): AgentMessageResponseDto {
    return {
      id: entity.id,
      sessionId: entity.sessionId,
      runId: entity.runId,
      role: entity.role,
      orderIndex: entity.orderIndex,
      contentText: entity.contentText,
      contentJson: entity.contentJson,
      status: entity.status,
      parentId: entity.parentId,
      createdAt: entity.createdAt,
    };
  },
};
