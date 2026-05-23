import type { AgentReviewGateRepository } from "../../infrastructure/repository/AgentReviewGateRepository";
import { AgentReviewGateMapper } from "../../infrastructure/mappers/AgentReviewGateMapper";
import type { CreateAgentReviewGateRequestDto } from "../../api/dto/CreateAgentReviewGateRequestDto";
import type { UpdateAgentReviewGateRequestDto } from "../../api/dto/UpdateAgentReviewGateRequestDto";
import type { AgentReviewGateQueryDto } from "../../api/dto/AgentReviewGateQueryDto";
import type { AgentReviewGateResponseDto } from "../../api/dto/AgentReviewGateResponseDto";

/** Agent Review Gate 表，保存 Agent 运行时暂停点、人工确认问题、建议、风险和决策基础 CRUD 服务 */
export class AgentReviewGateCrudService {
  constructor(private readonly repository: AgentReviewGateRepository) {}

  async list(query: AgentReviewGateQueryDto): Promise<{ items: AgentReviewGateResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentReviewGateMapper.toResponseDto(AgentReviewGateMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentReviewGateResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentReviewGateMapper.toResponseDto(AgentReviewGateMapper.toEntity(record));
  }

  async create(payload: CreateAgentReviewGateRequestDto): Promise<AgentReviewGateResponseDto> {
    const created = await this.repository.create(payload);
    return AgentReviewGateMapper.toResponseDto(AgentReviewGateMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentReviewGateRequestDto): Promise<AgentReviewGateResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentReviewGateMapper.toResponseDto(AgentReviewGateMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
