import type { AgentRunEventRecord } from "../persistence/AgentRunEventRecord";
import type { CreateAgentRunEventRequestDto } from "../../api/dto/CreateAgentRunEventRequestDto";
import type { UpdateAgentRunEventRequestDto } from "../../api/dto/UpdateAgentRunEventRequestDto";
import type { AgentRunEventQueryDto } from "../../api/dto/AgentRunEventQueryDto";

/** Agent 运行事件表，保存 Pi lifecycle、assistant delta、tool event 与 review gate 事件以支持 SSE 重放仓储接口 */
export interface AgentRunEventRepository {
  list(query: AgentRunEventQueryDto): Promise<{ items: AgentRunEventRecord[]; total: number }>;
  getById(id: string): Promise<AgentRunEventRecord | null>;
  create(payload: CreateAgentRunEventRequestDto): Promise<AgentRunEventRecord>;
  update(id: string, payload: UpdateAgentRunEventRequestDto): Promise<AgentRunEventRecord>;
  remove(id: string): Promise<void>;
}
