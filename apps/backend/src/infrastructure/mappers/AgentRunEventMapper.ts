import type { AgentRunEvent } from "../../domain/entities/AgentRunEvent";
import type { AgentRunEventRecord } from "../persistence/AgentRunEventRecord";
import type { AgentRunEventResponseDto } from "../../api/dto/AgentRunEventResponseDto";

/** Agent 运行事件表，保存 Pi lifecycle、assistant delta、tool event 与 review gate 事件以支持 SSE 重放映射器 */
export const AgentRunEventMapper = {
  toEntity(record: AgentRunEventRecord): AgentRunEvent {
    return {
      id: record.id,
      runId: record.run_id,
      sequence: record.sequence,
      eventType: record.event_type,
      eventPhase: record.event_phase,
      payloadJson: record.payload_json,
      createdAt: record.created_at,
    };
  },

  toResponseDto(entity: AgentRunEvent): AgentRunEventResponseDto {
    return {
      id: entity.id,
      runId: entity.runId,
      sequence: entity.sequence,
      eventType: entity.eventType,
      eventPhase: entity.eventPhase,
      payloadJson: entity.payloadJson,
      createdAt: entity.createdAt,
    };
  },
};
