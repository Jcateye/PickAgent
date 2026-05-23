import type { ActivitySimulationRunRepository } from "../../infrastructure/repository/ActivitySimulationRunRepository";
import { ActivitySimulationRunMapper } from "../../infrastructure/mappers/ActivitySimulationRunMapper";
import type { CreateActivitySimulationRunRequestDto } from "../../api/dto/CreateActivitySimulationRunRequestDto";
import type { UpdateActivitySimulationRunRequestDto } from "../../api/dto/UpdateActivitySimulationRunRequestDto";
import type { ActivitySimulationRunQueryDto } from "../../api/dto/ActivitySimulationRunQueryDto";
import type { ActivitySimulationRunResponseDto } from "../../api/dto/ActivitySimulationRunResponseDto";

/** 活动准入模拟运行表基础 CRUD 服务 */
export class ActivitySimulationRunCrudService {
  constructor(private readonly repository: ActivitySimulationRunRepository) {}

  async list(query: ActivitySimulationRunQueryDto): Promise<{ items: ActivitySimulationRunResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => ActivitySimulationRunMapper.toResponseDto(ActivitySimulationRunMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<ActivitySimulationRunResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return ActivitySimulationRunMapper.toResponseDto(ActivitySimulationRunMapper.toEntity(record));
  }

  async create(payload: CreateActivitySimulationRunRequestDto): Promise<ActivitySimulationRunResponseDto> {
    const created = await this.repository.create(payload);
    return ActivitySimulationRunMapper.toResponseDto(ActivitySimulationRunMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateActivitySimulationRunRequestDto): Promise<ActivitySimulationRunResponseDto> {
    const updated = await this.repository.update(id, payload);
    return ActivitySimulationRunMapper.toResponseDto(ActivitySimulationRunMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
