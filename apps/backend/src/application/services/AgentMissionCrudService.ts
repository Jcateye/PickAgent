import type { AgentMissionRepository } from "../../infrastructure/repository/AgentMissionRepository";
import { AgentMissionMapper } from "../../infrastructure/mappers/AgentMissionMapper";
import type { CreateAgentMissionRequestDto } from "../../api/dto/CreateAgentMissionRequestDto";
import type { UpdateAgentMissionRequestDto } from "../../api/dto/UpdateAgentMissionRequestDto";
import type { AgentMissionQueryDto } from "../../api/dto/AgentMissionQueryDto";
import type { AgentMissionResponseDto } from "../../api/dto/AgentMissionResponseDto";

/** Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态基础 CRUD 服务 */
export class AgentMissionCrudService {
  constructor(private readonly repository: AgentMissionRepository) {}

  async list(query: AgentMissionQueryDto): Promise<{ items: AgentMissionResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => AgentMissionMapper.toResponseDto(AgentMissionMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<AgentMissionResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return AgentMissionMapper.toResponseDto(AgentMissionMapper.toEntity(record));
  }

  async create(payload: CreateAgentMissionRequestDto): Promise<AgentMissionResponseDto> {
    const created = await this.repository.create(payload);
    return AgentMissionMapper.toResponseDto(AgentMissionMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateAgentMissionRequestDto): Promise<AgentMissionResponseDto> {
    const updated = await this.repository.update(id, payload);
    return AgentMissionMapper.toResponseDto(AgentMissionMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
