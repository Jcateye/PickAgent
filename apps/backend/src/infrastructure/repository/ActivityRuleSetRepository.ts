import type { ActivityRuleSetRecord } from "../persistence/ActivityRuleSetRecord";
import type { CreateActivityRuleSetRequestDto } from "../../api/dto/CreateActivityRuleSetRequestDto";
import type { UpdateActivityRuleSetRequestDto } from "../../api/dto/UpdateActivityRuleSetRequestDto";
import type { ActivityRuleSetQueryDto } from "../../api/dto/ActivityRuleSetQueryDto";

/** 活动规则集表，保存规则原文、Rule DSL 和解析元数据仓储接口 */
export interface ActivityRuleSetRepository {
  list(query: ActivityRuleSetQueryDto): Promise<{ items: ActivityRuleSetRecord[]; total: number }>;
  getById(id: string): Promise<ActivityRuleSetRecord | null>;
  create(payload: CreateActivityRuleSetRequestDto): Promise<ActivityRuleSetRecord>;
  update(id: string, payload: UpdateActivityRuleSetRequestDto): Promise<ActivityRuleSetRecord>;
  remove(id: string): Promise<void>;
}
