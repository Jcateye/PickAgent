import type { WorkflowStepRepository } from "../../infrastructure/repository/WorkflowStepRepository";
import { WorkflowStepMapper } from "../../infrastructure/mappers/WorkflowStepMapper";
import type { CreateWorkflowStepRequestDto } from "../../api/dto/CreateWorkflowStepRequestDto";
import type { UpdateWorkflowStepRequestDto } from "../../api/dto/UpdateWorkflowStepRequestDto";
import type { WorkflowStepQueryDto } from "../../api/dto/WorkflowStepQueryDto";
import type { WorkflowStepResponseDto } from "../../api/dto/WorkflowStepResponseDto";

/** 工作流步骤审计表基础 CRUD 服务 */
export class WorkflowStepCrudService {
  constructor(private readonly repository: WorkflowStepRepository) {}

  async list(query: WorkflowStepQueryDto): Promise<{ items: WorkflowStepResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => WorkflowStepMapper.toResponseDto(WorkflowStepMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<WorkflowStepResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return WorkflowStepMapper.toResponseDto(WorkflowStepMapper.toEntity(record));
  }

  async create(payload: CreateWorkflowStepRequestDto): Promise<WorkflowStepResponseDto> {
    const created = await this.repository.create(payload);
    return WorkflowStepMapper.toResponseDto(WorkflowStepMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateWorkflowStepRequestDto): Promise<WorkflowStepResponseDto> {
    const updated = await this.repository.update(id, payload);
    return WorkflowStepMapper.toResponseDto(WorkflowStepMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
