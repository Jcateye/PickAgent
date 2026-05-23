import type { SkuSnapshotRecord } from "../persistence/SkuSnapshotRecord";
import type { CreateSkuSnapshotRequestDto } from "../../api/dto/CreateSkuSnapshotRequestDto";
import type { UpdateSkuSnapshotRequestDto } from "../../api/dto/UpdateSkuSnapshotRequestDto";
import type { SkuSnapshotQueryDto } from "../../api/dto/SkuSnapshotQueryDto";

/** SKU 采集事实快照表仓储接口 */
export interface SkuSnapshotRepository {
  list(query: SkuSnapshotQueryDto): Promise<{ items: SkuSnapshotRecord[]; total: number }>;
  getById(id: string): Promise<SkuSnapshotRecord | null>;
  create(payload: CreateSkuSnapshotRequestDto): Promise<SkuSnapshotRecord>;
  update(id: string, payload: UpdateSkuSnapshotRequestDto): Promise<SkuSnapshotRecord>;
  remove(id: string): Promise<void>;
}
