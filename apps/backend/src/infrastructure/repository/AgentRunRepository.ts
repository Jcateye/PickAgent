import type { AgentRunRecord } from "../persistence/AgentRunRecord";
import type { CreateAgentRunRequestDto } from "../../api/dto/CreateAgentRunRequestDto";
import type { UpdateAgentRunRequestDto } from "../../api/dto/UpdateAgentRunRequestDto";
import type { AgentRunQueryDto } from "../../api/dto/AgentRunQueryDto";

/** Agent Run 表，保存 Pi 单次运行、模型信息、状态和 WorkflowRun 关联仓储接口 */
export interface AgentRunRepository {
  list(query: AgentRunQueryDto): Promise<{ items: AgentRunRecord[]; total: number }>;
  getById(id: string): Promise<AgentRunRecord | null>;
  create(payload: CreateAgentRunRequestDto): Promise<AgentRunRecord>;
  update(id: string, payload: UpdateAgentRunRequestDto): Promise<AgentRunRecord>;
  remove(id: string): Promise<void>;
}
