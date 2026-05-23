import type { AgentReviewGateCrudService } from "../../application/services/AgentReviewGateCrudService";
import type { CreateAgentReviewGateRequestDto } from "../dto/CreateAgentReviewGateRequestDto";
import type { UpdateAgentReviewGateRequestDto } from "../dto/UpdateAgentReviewGateRequestDto";
import type { AgentReviewGateQueryDto } from "../dto/AgentReviewGateQueryDto";
import type { AgentReviewGateResponseDto } from "../dto/AgentReviewGateResponseDto";

/** Agent Review Gate 表，保存 Agent 运行时暂停点、人工确认问题、建议、风险和决策控制器骨架 */
export class AgentReviewGateController {
  constructor(private readonly service: AgentReviewGateCrudService) {}

  async list(query: AgentReviewGateQueryDto): Promise<{ items: AgentReviewGateResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentReviewGateResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentReviewGateRequestDto): Promise<AgentReviewGateResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentReviewGateRequestDto): Promise<AgentReviewGateResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
