import type { AgentMissionRecord } from "../persistence/AgentMissionRecord";
import type { CreateAgentMissionRequestDto } from "../../api/dto/CreateAgentMissionRequestDto";
import type { UpdateAgentMissionRequestDto } from "../../api/dto/UpdateAgentMissionRequestDto";
import type { AgentMissionQueryDto } from "../../api/dto/AgentMissionQueryDto";

/** Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态仓储接口 */
export interface AgentMissionRepository {
  list(query: AgentMissionQueryDto): Promise<{ items: AgentMissionRecord[]; total: number }>;
  getById(id: string): Promise<AgentMissionRecord | null>;
  create(payload: CreateAgentMissionRequestDto): Promise<AgentMissionRecord>;
  update(id: string, payload: UpdateAgentMissionRequestDto): Promise<AgentMissionRecord>;
  remove(id: string): Promise<void>;
}
