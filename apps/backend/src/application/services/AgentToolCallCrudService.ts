import type { AgentToolCallRepository } from "../../infrastructure/repository/AgentToolCallRepository";
import { AgentToolCallMapper } from "../../infrastructure/mappers/AgentToolCallMapper";
import type { CreateAgentToolCallRequestDto } from "../../api/dto/CreateAgentToolCallRequestDto";
import type { UpdateAgentToolCallRequestDto } from "../../api/dto/UpdateAgentToolCallRequestDto";
import type { AgentToolCallQueryDto } from "../../api/dto/AgentToolCallQueryDto";
import type { AgentToolCallResponseDto } from "../../api/dto/AgentToolCallResponseDto";

/** Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用基础 CRUD 服务 */
export class AgentToolCallCrudService {
  constructor(private readonly repository: AgentToolCallRepository) {}

  async list(query: AgentToolCallQueryDto): Promise<{ items: AgentToolCallResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentToolCallMapper.toResponseDto(AgentToolCallMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentToolCallResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentToolCallMapper.toResponseDto(AgentToolCallMapper.toEntity(record));
  }

  async create(payload: CreateAgentToolCallRequestDto): Promise<AgentToolCallResponseDto> {
    const created = await this.repository.create(payload);
    return AgentToolCallMapper.toResponseDto(AgentToolCallMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentToolCallRequestDto): Promise<AgentToolCallResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentToolCallMapper.toResponseDto(AgentToolCallMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
