import type { ActivityRepository } from "../../infrastructure/repository/ActivityRepository";
import { ActivityMapper } from "../../infrastructure/mappers/ActivityMapper";
import type { CreateActivityRequestDto } from "../../api/dto/CreateActivityRequestDto";
import type { UpdateActivityRequestDto } from "../../api/dto/UpdateActivityRequestDto";
import type { ActivityQueryDto } from "../../api/dto/ActivityQueryDto";
import type { ActivityResponseDto } from "../../api/dto/ActivityResponseDto";

/** 活动主对象表，承载活动名称、范围、状态、时间窗、当前规则集和最新运行引用基础 CRUD 服务 */
export class ActivityCrudService {
  constructor(private readonly repository: ActivityRepository) {}

  async list(query: ActivityQueryDto): Promise<{ items: ActivityResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return { items: result.items.map((item) => ActivityMapper.toResponseDto(ActivityMapper.toEntity(item))), page: query.page ?? 1, pageSize: query.pageSize ?? 20, total: result.total };
  }

  async getById(id: string): Promise<ActivityResponseDto | null> {
    const record = await this.repository.getById(id);
    return record ? ActivityMapper.toResponseDto(ActivityMapper.toEntity(record)) : null;
  }

  async create(payload: CreateActivityRequestDto): Promise<ActivityResponseDto> {
    return ActivityMapper.toResponseDto(ActivityMapper.toEntity(await this.repository.create(payload)));
  }

  async update(id: string, payload: UpdateActivityRequestDto): Promise<ActivityResponseDto> {
    return ActivityMapper.toResponseDto(ActivityMapper.toEntity(await this.repository.update(id, payload)));
  }

  async remove(id: string): Promise<void> { await this.repository.remove(id); }
}
