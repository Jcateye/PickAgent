import type { AgentMessageRecord } from "../persistence/AgentMessageRecord";
import type { CreateAgentMessageRequestDto } from "../../api/dto/CreateAgentMessageRequestDto";
import type { UpdateAgentMessageRequestDto } from "../../api/dto/UpdateAgentMessageRequestDto";
import type { AgentMessageQueryDto } from "../../api/dto/AgentMessageQueryDto";

/** Agent 消息表，保存 Copilot 会话消息并支持刷新恢复和历史回看仓储接口 */
export interface AgentMessageRepository {
  list(query: AgentMessageQueryDto): Promise<{ items: AgentMessageRecord[]; total: number }>;
  getById(id: string): Promise<AgentMessageRecord | null>;
  create(payload: CreateAgentMessageRequestDto): Promise<AgentMessageRecord>;
  update(id: string, payload: UpdateAgentMessageRequestDto): Promise<AgentMessageRecord>;
  remove(id: string): Promise<void>;
}
