import type { AgentMissionCrudService } from "../../application/services/AgentMissionCrudService";
import type { CreateAgentMissionRequestDto } from "../dto/CreateAgentMissionRequestDto";
import type { UpdateAgentMissionRequestDto } from "../dto/UpdateAgentMissionRequestDto";
import type { AgentMissionQueryDto } from "../dto/AgentMissionQueryDto";
import type { AgentMissionResponseDto } from "../dto/AgentMissionResponseDto";

/** Agent Mission 表，保存 Agent Copilot 的业务目标、约束、计划与状态控制器骨架 */
export class AgentMissionController {
  constructor(private readonly service: AgentMissionCrudService) {}

  async list(query: AgentMissionQueryDto): Promise<{ items: AgentMissionResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentMissionResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentMissionRequestDto): Promise<AgentMissionResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentMissionRequestDto): Promise<AgentMissionResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
