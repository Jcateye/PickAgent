import type { RuleSetVersionRecord } from "../persistence/RuleSetVersionRecord";
import type { CreateRuleSetVersionRequestDto } from "../../api/dto/CreateRuleSetVersionRequestDto";
import type { UpdateRuleSetVersionRequestDto } from "../../api/dto/UpdateRuleSetVersionRequestDto";
import type { RuleSetVersionQueryDto } from "../../api/dto/RuleSetVersionQueryDto";

/** 规则库版本表，保存规则集历史版本、Rule DSL 快照和发布状态仓储接口 */
export interface RuleSetVersionRepository {
  list(query: RuleSetVersionQueryDto): Promise<{ items: RuleSetVersionRecord[]; total: number }>;
  getById(id: string): Promise<RuleSetVersionRecord | null>;
  create(payload: CreateRuleSetVersionRequestDto): Promise<RuleSetVersionRecord>;
  update(id: string, payload: UpdateRuleSetVersionRequestDto): Promise<RuleSetVersionRecord>;
  remove(id: string): Promise<void>;
}
