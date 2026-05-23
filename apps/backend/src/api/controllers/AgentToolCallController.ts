import type { AgentToolCallCrudService } from "../../application/services/AgentToolCallCrudService";
import type { CreateAgentToolCallRequestDto } from "../dto/CreateAgentToolCallRequestDto";
import type { UpdateAgentToolCallRequestDto } from "../dto/UpdateAgentToolCallRequestDto";
import type { AgentToolCallQueryDto } from "../dto/AgentToolCallQueryDto";
import type { AgentToolCallResponseDto } from "../dto/AgentToolCallResponseDto";

/** Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用控制器骨架 */
export class AgentToolCallController {
  constructor(private readonly service: AgentToolCallCrudService) {}

  async list(query: AgentToolCallQueryDto): Promise<{ items: AgentToolCallResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentToolCallResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentToolCallRequestDto): Promise<AgentToolCallResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentToolCallRequestDto): Promise<AgentToolCallResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
