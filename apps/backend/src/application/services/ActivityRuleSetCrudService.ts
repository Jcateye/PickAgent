import type { ActivityRuleSetRepository } from "../../infrastructure/repository/ActivityRuleSetRepository";
import { ActivityRuleSetMapper } from "../../infrastructure/mappers/ActivityRuleSetMapper";
import type { CreateActivityRuleSetRequestDto } from "../../api/dto/CreateActivityRuleSetRequestDto";
import type { UpdateActivityRuleSetRequestDto } from "../../api/dto/UpdateActivityRuleSetRequestDto";
import type { ActivityRuleSetQueryDto } from "../../api/dto/ActivityRuleSetQueryDto";
import type { ActivityRuleSetResponseDto } from "../../api/dto/ActivityRuleSetResponseDto";

/** 活动规则集表，保存规则原文、Rule DSL 和解析元数据基础 CRUD 服务 */
export class ActivityRuleSetCrudService {
  constructor(private readonly repository: ActivityRuleSetRepository) {}

  async list(query: ActivityRuleSetQueryDto): Promise<{ items: ActivityRuleSetResponseDto[]; page: number; pageSize: number; total: number }> {
    const result = await this.repository.list(query);
    return {
      items: result.items.map((item) => ActivityRuleSetMapper.toResponseDto(ActivityRuleSetMapper.toEntity(item))),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      total: result.total,
    };
  }

  async getById(id: string): Promise<ActivityRuleSetResponseDto | null> {
    const record = await this.repository.getById(id);
    if (!record) {
      return null;
    }
    return ActivityRuleSetMapper.toResponseDto(ActivityRuleSetMapper.toEntity(record));
  }

  async create(payload: CreateActivityRuleSetRequestDto): Promise<ActivityRuleSetResponseDto> {
    const created = await this.repository.create(payload);
    return ActivityRuleSetMapper.toResponseDto(ActivityRuleSetMapper.toEntity(created));
  }

  async update(id: string, payload: UpdateActivityRuleSetRequestDto): Promise<ActivityRuleSetResponseDto> {
    const updated = await this.repository.update(id, payload);
    return ActivityRuleSetMapper.toResponseDto(ActivityRuleSetMapper.toEntity(updated));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
  }
}
