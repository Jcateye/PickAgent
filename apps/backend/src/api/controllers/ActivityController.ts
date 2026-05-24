import type { ActivityCrudService } from "../../application/services/ActivityCrudService";
import type { CreateActivityRequestDto } from "../dto/CreateActivityRequestDto";
import type { UpdateActivityRequestDto } from "../dto/UpdateActivityRequestDto";
import type { ActivityQueryDto } from "../dto/ActivityQueryDto";
import type { ActivityResponseDto } from "../dto/ActivityResponseDto";

/** 活动主对象表，承载活动名称、范围、状态、时间窗、当前规则集和最新运行引用控制器骨架 */
export class ActivityController {
  constructor(private readonly service: ActivityCrudService) {}
  async list(query: ActivityQueryDto): Promise<{ items: ActivityResponseDto[]; page: number; pageSize: number; total: number }> { return this.service.list(query); }
  async detail(id: string): Promise<ActivityResponseDto | null> { return this.service.getById(id); }
  async create(payload: CreateActivityRequestDto): Promise<ActivityResponseDto> { return this.service.create(payload); }
  async update(id: string, payload: UpdateActivityRequestDto): Promise<ActivityResponseDto> { return this.service.update(id, payload); }
  async remove(id: string): Promise<void> { return this.service.remove(id); }
}
