import type { AgentToolCallRecord } from "../persistence/AgentToolCallRecord";
import type { CreateAgentToolCallRequestDto } from "../../api/dto/CreateAgentToolCallRequestDto";
import type { UpdateAgentToolCallRequestDto } from "../../api/dto/UpdateAgentToolCallRequestDto";
import type { AgentToolCallQueryDto } from "../../api/dto/AgentToolCallQueryDto";

/** Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用仓储接口 */
export interface AgentToolCallRepository {
  list(query: AgentToolCallQueryDto): Promise<{ items: AgentToolCallRecord[]; total: number }>;
  getById(id: string): Promise<AgentToolCallRecord | null>;
  create(payload: CreateAgentToolCallRequestDto): Promise<AgentToolCallRecord>;
  update(id: string, payload: UpdateAgentToolCallRequestDto): Promise<AgentToolCallRecord>;
  remove(id: string): Promise<void>;
}
