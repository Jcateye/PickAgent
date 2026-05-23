import type { AgentSessionCrudService } from "../../application/services/AgentSessionCrudService";
import type { CreateAgentSessionRequestDto } from "../dto/CreateAgentSessionRequestDto";
import type { UpdateAgentSessionRequestDto } from "../dto/UpdateAgentSessionRequestDto";
import type { AgentSessionQueryDto } from "../dto/AgentSessionQueryDto";
import type { AgentSessionResponseDto } from "../dto/AgentSessionResponseDto";

/** Agent 会话表，保存用户或工作台上下文下的长期 Agent 会话并映射 Pi session控制器骨架 */
export class AgentSessionController {
  constructor(private readonly service: AgentSessionCrudService) {}

  async list(query: AgentSessionQueryDto): Promise<{ items: AgentSessionResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentSessionResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentSessionRequestDto): Promise<AgentSessionResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentSessionRequestDto): Promise<AgentSessionResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
