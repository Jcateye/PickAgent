import type { AgentSessionRecord } from "../persistence/AgentSessionRecord";
import type { CreateAgentSessionRequestDto } from "../../api/dto/CreateAgentSessionRequestDto";
import type { UpdateAgentSessionRequestDto } from "../../api/dto/UpdateAgentSessionRequestDto";
import type { AgentSessionQueryDto } from "../../api/dto/AgentSessionQueryDto";

/** Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session仓储接口 */
export interface AgentSessionRepository {
  list(query: AgentSessionQueryDto): Promise<{ items: AgentSessionRecord[]; total: number }>;
  getById(id: string): Promise<AgentSessionRecord | null>;
  create(payload: CreateAgentSessionRequestDto): Promise<AgentSessionRecord>;
  update(id: string, payload: UpdateAgentSessionRequestDto): Promise<AgentSessionRecord>;
  remove(id: string): Promise<void>;
}
