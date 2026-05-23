import type { AgentContextLinkRecord } from "../persistence/AgentContextLinkRecord";
import type { CreateAgentContextLinkRequestDto } from "../../api/dto/CreateAgentContextLinkRequestDto";
import type { UpdateAgentContextLinkRequestDto } from "../../api/dto/UpdateAgentContextLinkRequestDto";
import type { AgentContextLinkQueryDto } from "../../api/dto/AgentContextLinkQueryDto";

/** Agent 上下文关联表，把消息、工具、Review Gate 与工作台对象关联以支持高亮、跳转和对照仓储接口 */
export interface AgentContextLinkRepository {
  list(query: AgentContextLinkQueryDto): Promise<{ items: AgentContextLinkRecord[]; total: number }>;
  getById(id: string): Promise<AgentContextLinkRecord | null>;
  create(payload: CreateAgentContextLinkRequestDto): Promise<AgentContextLinkRecord>;
  update(id: string, payload: UpdateAgentContextLinkRequestDto): Promise<AgentContextLinkRecord>;
  remove(id: string): Promise<void>;
}
