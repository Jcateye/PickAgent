import type { ActivitySimulationResultRepository } from "../../infrastructure/repository/ActivitySimulationResultRepository";
import { ActivitySimulationResultMapper } from "../../infrastructure/mappers/ActivitySimulationResultMapper";
import type { CreateActivitySimulationResultRequestDto } from "../../api/dto/CreateActivitySimulationResultRequestDto";
import type { UpdateActivitySimulationResultRequestDto } from "../../api/dto/UpdateActivitySimulationResultRequestDto";
import type { ActivitySimulationResultQueryDto } from "../../api/dto/ActivitySimulationResultQueryDto";
import type { ActivitySimulationResultResponseDto } from "../../api/dto/ActivitySimulationResultResponseDto";

/** 单个 SKU 在某次活动模拟中的准入结论表基础 CRUD 服务 */
export class ActivitySimulationResultCrudService {
  constructor(private readonly repository: ActivitySimulationResultRepository) {}

  async list(query: ActivitySimulationResultQueryDto): Promise<{ items: ActivitySimulationResultResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => ActivitySimulationResultMapper.toResponseDto(ActivitySimulationResultMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<ActivitySimulationResultResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return ActivitySimulationResultMapper.toResponseDto(ActivitySimulationResultMapper.toEntity(record));
  }

  async create(payload: CreateActivitySimulationResultRequestDto): Promise<ActivitySimulationResultResponseDto> {
    const created = await this.repository.create(payload);
    return ActivitySimulationResultMapper.toResponseDto(ActivitySimulationResultMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateActivitySimulationResultRequestDto): Promise<ActivitySimulationResultResponseDto> {
    const updated = await this.repository.update(id, payload);
    return ActivitySimulationResultMapper.toResponseDto(ActivitySimulationResultMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
