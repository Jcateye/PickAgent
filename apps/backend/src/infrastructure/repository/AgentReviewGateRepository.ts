import type { AgentReviewGateRecord } from "../persistence/AgentReviewGateRecord";
import type { CreateAgentReviewGateRequestDto } from "../../api/dto/CreateAgentReviewGateRequestDto";
import type { UpdateAgentReviewGateRequestDto } from "../../api/dto/UpdateAgentReviewGateRequestDto";
import type { AgentReviewGateQueryDto } from "../../api/dto/AgentReviewGateQueryDto";

/** Agent Review Gate 表，保存 Agent 运行时暂停点、人工确认问题、建议、风险和决策仓储接口 */
export interface AgentReviewGateRepository {
  list(query: AgentReviewGateQueryDto): Promise<{ items: AgentReviewGateRecord[]; total: number }>;
  getById(id: string): Promise<AgentReviewGateRecord | null>;
  create(payload: CreateAgentReviewGateRequestDto): Promise<AgentReviewGateRecord>;
  update(id: string, payload: UpdateAgentReviewGateRequestDto): Promise<AgentReviewGateRecord>;
  remove(id: string): Promise<void>;
}
