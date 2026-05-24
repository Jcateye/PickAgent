import type { ActivityRecord } from "../persistence/ActivityRecord";
import type { CreateActivityRequestDto } from "../../api/dto/CreateActivityRequestDto";
import type { UpdateActivityRequestDto } from "../../api/dto/UpdateActivityRequestDto";
import type { ActivityQueryDto } from "../../api/dto/ActivityQueryDto";

/** 活动主对象表，承载活动名称、范围、状态、时间窗、当前规则集和最新运行引用仓储接口 */
export interface ActivityRepository {
  list(query: ActivityQueryDto): Promise<{ items: ActivityRecord[]; total: number }>;
  getById(id: string): Promise<ActivityRecord | null>;
  create(payload: CreateActivityRequestDto): Promise<ActivityRecord>;
  update(id: string, payload: UpdateActivityRequestDto): Promise<ActivityRecord>;
  remove(id: string): Promise<void>;
}
