import type { CurrentSkuProjectionRecord } from "../persistence/CurrentSkuProjectionRecord";
import type { CreateCurrentSkuProjectionRequestDto } from "../../api/dto/CreateCurrentSkuProjectionRequestDto";
import type { UpdateCurrentSkuProjectionRequestDto } from "../../api/dto/UpdateCurrentSkuProjectionRequestDto";
import type { CurrentSkuProjectionQueryDto } from "../../api/dto/CurrentSkuProjectionQueryDto";

/** SKU 当前状态读模型表，供 Dashboard、SKU List、Chat summary 和 Report summary 查询仓储接口 */
export interface CurrentSkuProjectionRepository {
  list(query: CurrentSkuProjectionQueryDto): Promise<{ items: CurrentSkuProjectionRecord[]; total: number }>;
  getById(id: string): Promise<CurrentSkuProjectionRecord | null>;
  create(payload: CreateCurrentSkuProjectionRequestDto): Promise<CurrentSkuProjectionRecord>;
  update(id: string, payload: UpdateCurrentSkuProjectionRequestDto): Promise<CurrentSkuProjectionRecord>;
  remove(id: string): Promise<void>;
}
