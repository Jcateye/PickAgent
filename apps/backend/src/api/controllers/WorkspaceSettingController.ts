import type { WorkspaceSettingCrudService } from "../../application/services/WorkspaceSettingCrudService";
import type { CreateWorkspaceSettingRequestDto } from "../dto/CreateWorkspaceSettingRequestDto";
import type { UpdateWorkspaceSettingRequestDto } from "../dto/UpdateWorkspaceSettingRequestDto";
import type { WorkspaceSettingQueryDto } from "../dto/WorkspaceSettingQueryDto";
import type { WorkspaceSettingResponseDto } from "../dto/WorkspaceSettingResponseDto";

/** 工作区设置表，保存数据 freshness、Review SLA、工具策略等 P0 配置控制器骨架 */
export class WorkspaceSettingController {
  constructor(private readonly service: WorkspaceSettingCrudService) {}
  async list(query: WorkspaceSettingQueryDto): Promise<{ items: WorkspaceSettingResponseDto[]; page: number; pageSize: number; total: number }> { return this.service.list(query); }
  async detail(id: string): Promise<WorkspaceSettingResponseDto | null> { return this.service.getById(id); }
  async create(payload: CreateWorkspaceSettingRequestDto): Promise<WorkspaceSettingResponseDto> { return this.service.create(payload); }
  async update(id: string, payload: UpdateWorkspaceSettingRequestDto): Promise<WorkspaceSettingResponseDto> { return this.service.update(id, payload); }
  async remove(id: string): Promise<void> { return this.service.remove(id); }
}
