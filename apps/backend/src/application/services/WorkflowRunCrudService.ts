import type { WorkflowRunRepository } from "../../infrastructure/repository/WorkflowRunRepository";
import { WorkflowRunMapper } from "../../infrastructure/mappers/WorkflowRunMapper";
import type { CreateWorkflowRunRequestDto } from "../../api/dto/CreateWorkflowRunRequestDto";
import type { UpdateWorkflowRunRequestDto } from "../../api/dto/UpdateWorkflowRunRequestDto";
import type { WorkflowRunQueryDto } from "../../api/dto/WorkflowRunQueryDto";
import type { WorkflowRunResponseDto } from "../../api/dto/WorkflowRunResponseDto";

/** 工作流运行审计表基础 CRUD 服务 */
export class WorkflowRunCrudService {
  constructor(private readonly repository: WorkflowRunRepository) {}

  async list(query: WorkflowRunQueryDto): Promise<{ items: WorkflowRunResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => WorkflowRunMapper.toResponseDto(WorkflowRunMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<WorkflowRunResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return WorkflowRunMapper.toResponseDto(WorkflowRunMapper.toEntity(record));
  }

  async create(payload: CreateWorkflowRunRequestDto): Promise<WorkflowRunResponseDto> {
    const created = await this.repository.create(payload);
    return WorkflowRunMapper.toResponseDto(WorkflowRunMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateWorkflowRunRequestDto): Promise<WorkflowRunResponseDto> {
    const updated = await this.repository.update(id, payload);
    return WorkflowRunMapper.toResponseDto(WorkflowRunMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
