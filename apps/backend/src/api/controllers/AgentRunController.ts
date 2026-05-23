import type { AgentRunCrudService } from "../../application/services/AgentRunCrudService";
import type { CreateAgentRunRequestDto } from "../dto/CreateAgentRunRequestDto";
import type { UpdateAgentRunRequestDto } from "../dto/UpdateAgentRunRequestDto";
import type { AgentRunQueryDto } from "../dto/AgentRunQueryDto";
import type { AgentRunResponseDto } from "../dto/AgentRunResponseDto";

/** Agent Run 表，保存 Pi 单次运行、模型信息、状态和 WorkflowRun 关联控制器骨架 */
export class AgentRunController {
  constructor(private readonly service: AgentRunCrudService) {}

  async list(query: AgentRunQueryDto): Promise<{ items: AgentRunResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentRunResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentRunRequestDto): Promise<AgentRunResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentRunRequestDto): Promise<AgentRunResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
