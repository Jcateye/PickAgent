import type { WorkspaceSettingRepository } from "../../infrastructure/repository/WorkspaceSettingRepository";
import { WorkspaceSettingMapper } from "../../infrastructure/mappers/WorkspaceSettingMapper";
import type { CreateWorkspaceSettingRequestDto } from "../../api/dto/CreateWorkspaceSettingRequestDto";
import type { UpdateWorkspaceSettingRequestDto } from "../../api/dto/UpdateWorkspaceSettingRequestDto";
import type { WorkspaceSettingQueryDto } from "../../api/dto/WorkspaceSettingQueryDto";
import type { WorkspaceSettingResponseDto } from "../../api/dto/WorkspaceSettingResponseDto";

/** 工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置基础 CRUD 服务 */
export class WorkspaceSettingCrudService {
  constructor(private readonly repository: WorkspaceSettingRepository) {}

  async list(query: WorkspaceSettingQueryDto): Promise<{ items: WorkspaceSettingResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return { items: result.items.map((item) => WorkspaceSettingMapper.toResponseDto(WorkspaceSettingMapper.toEntity(item))), page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: result.total };
  }

  async getById(id: string): Promise<WorkspaceSettingResponseDto | null> {
    const record = await this.repository.getById(id);
    return record ? WorkspaceSettingMapper.toResponseDto(WorkspaceSettingMapper.toEntity(record)) : null;
  }

  async create(payload: CreateWorkspaceSettingRequestDto): Promise<WorkspaceSettingResponseDto> {
    return WorkspaceSettingMapper.toResponseDto(WorkspaceSettingMapper.toEntity(await this.repository.create(payload)));
  }

  async update(id: string, payload: UpdateWorkspaceSettingRequestDto): Promise<WorkspaceSettingResponseDto> {
    return WorkspaceSettingMapper.toResponseDto(WorkspaceSettingMapper.toEntity(await this.repository.update(id, payload)));
  }

  async remove(id: string): Promise<void> { await this.repository.remove(id); }
}
