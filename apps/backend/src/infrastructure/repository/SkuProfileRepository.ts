import type { SkuProfileRecord } from "../persistence/SkuProfileRecord";
import type { CreateSkuProfileRequestDto } from "../../api/dto/CreateSkuProfileRequestDto";
import type { UpdateSkuProfileRequestDto } from "../../api/dto/UpdateSkuProfileRequestDto";
import type { SkuProfileQueryDto } from "../../api/dto/SkuProfileQueryDto";

/** 长期 SKU 档案表，承接采集事实、健康结论、活动模拟和 Review仓储接口 */
export interface SkuProfileRepository {
  list(query: SkuProfileQueryDto): Promise<{ items: SkuProfileRecord[]; total: number }>;
  getById(id: string): Promise<SkuProfileRecord | null>;
  create(payload: CreateSkuProfileRequestDto): Promise<SkuProfileRecord>;
  update(id: string, payload: UpdateSkuProfileRequestDto): Promise<SkuProfileRecord>;
  remove(id: string): Promise<void>;
}
