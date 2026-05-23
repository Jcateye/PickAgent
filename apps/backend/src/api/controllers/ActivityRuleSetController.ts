import type { ActivityRuleSetCrudService } from "../../application/services/ActivityRuleSetCrudService";
import type { CreateActivityRuleSetRequestDto } from "../dto/CreateActivityRuleSetRequestDto";
import type { UpdateActivityRuleSetRequestDto } from "../dto/UpdateActivityRuleSetRequestDto";
import type { ActivityRuleSetQueryDto } from "../dto/ActivityRuleSetQueryDto";
import type { ActivityRuleSetResponseDto } from "../dto/ActivityRuleSetResponseDto";

/** 活动规则集表，保存规则原文、Rule DSL 和解析元数据控制器骨架 */
export class ActivityRuleSetController {
  constructor(private readonly service: ActivityRuleSetCrudService) {}

  async list(query: ActivityRuleSetQueryDto): Promise<{ items: ActivityRuleSetResponseDto[]; page: number; pageSize: number; total: number }> {
    return this.service.list(query);
  }

  async detail(id: string): Promise<ActivityRuleSetResponseDto | null> {
    return this.service.getById(id);
  }

  async create(payload: CreateActivityRuleSetRequestDto): Promise<ActivityRuleSetResponseDto> {
    return this.service.create(payload);
  }

  async update(id: string, payload: UpdateActivityRuleSetRequestDto): Promise<ActivityRuleSetResponseDto> {
    return this.service.update(id, payload);
  }

  async remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}
