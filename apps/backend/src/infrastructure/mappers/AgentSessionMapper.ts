import type { AgentSession } from "../../domain/entities/AgentSession";
import type { AgentSessionRecord } from "../persistence/AgentSessionRecord";
import type { AgentSessionResponseDto } from "../../api/dto/AgentSessionResponseDto";

/** Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session映射器 */
export const AgentSessionMapper = {
  toEntity(record: AgentSessionRecord): AgentSession {
    return {
      id: record.id,
      sessionKey: record.session_key,
      userId: record.user_id,
      surface: record.surface,
      piSessionKey: record.pi_session_key,
      piSessionRef: record.pi_session_ref,
      title: record.title,
      status: record.status,
      configJson: record.config_json,
      lastActiveAt: record.last_active_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: AgentSession): AgentSessionResponseDto {
    return {
      id: entity.id,
      sessionKey: entity.sessionKey,
      userId: entity.userId,
      surface: entity.surface,
      piSessionKey: entity.piSessionKey,
      piSessionRef: entity.piSessionRef,
      title: entity.title,
      status: entity.status,
      configJson: entity.configJson,
      lastActiveAt: entity.lastActiveAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
