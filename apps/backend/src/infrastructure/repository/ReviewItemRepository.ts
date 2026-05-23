import type { ReviewItemRecord } from "../persistence/ReviewItemRecord";
import type { CreateReviewItemRequestDto } from "../../api/dto/CreateReviewItemRequestDto";
import type { UpdateReviewItemRequestDto } from "../../api/dto/UpdateReviewItemRequestDto";
import type { ReviewItemQueryDto } from "../../api/dto/ReviewItemQueryDto";

/** 人工 Review 审批任务表仓储接口 */
export interface ReviewItemRepository {
  list(query: ReviewItemQueryDto): Promise<{ items: ReviewItemRecord[]; total: number }>;
  getById(id: string): Promise<ReviewItemRecord | null>;
  create(payload: CreateReviewItemRequestDto): Promise<ReviewItemRecord>;
  update(id: string, payload: UpdateReviewItemRequestDto): Promise<ReviewItemRecord>;
  remove(id: string): Promise<void>;
}
