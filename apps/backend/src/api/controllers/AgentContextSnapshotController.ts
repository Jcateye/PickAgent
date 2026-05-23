import type { AgentContextSnapshotCrudService } from "../../application/services/AgentContextSnapshotCrudService";
import type { CreateAgentContextSnapshotRequestDto } from "../dto/CreateAgentContextSnapshotRequestDto";
import type { UpdateAgentContextSnapshotRequestDto } from "../dto/UpdateAgentContextSnapshotRequestDto";
import type { AgentContextSnapshotQueryDto } from "../dto/AgentContextSnapshotQueryDto";
import type { AgentContextSnapshotResponseDto } from "../dto/AgentContextSnapshotResponseDto";

/** Agent 上下文快照表，保存一次 run 中 Agent 当时可见的工作台上下文、系统上下文和证据摘要控制器骨架 */
export class AgentContextSnapshotController {
  constructor(private readonly service: AgentContextSnapshotCrudService) {}

  async list(query: AgentContextSnapshotQueryDto): Promise<{ items: AgentContextSnapshotResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<AgentContextSnapshotResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateAgentContextSnapshotRequestDto): Promise<AgentContextSnapshotResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateAgentContextSnapshotRequestDto): Promise<AgentContextSnapshotResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
