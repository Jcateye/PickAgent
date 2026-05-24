import type { RuleSetVersionCrudService } from "../../application/services/RuleSetVersionCrudService";
import type { CreateRuleSetVersionRequestDto } from "../dto/CreateRuleSetVersionRequestDto";
import type { UpdateRuleSetVersionRequestDto } from "../dto/UpdateRuleSetVersionRequestDto";
import type { RuleSetVersionQueryDto } from "../dto/RuleSetVersionQueryDto";
import type { RuleSetVersionResponseDto } from "../dto/RuleSetVersionResponseDto";

/** 规则库版本表，保存规则集历史版本、Rule DSL 快照和发布状态控制器骨架 */
export class RuleSetVersionController {
  constructor(private readonly service: RuleSetVersionCrudService) {}
  async list(query: RuleSetVersionQueryDto): Promise<{ items: RuleSetVersionResponseDto[]; page: number; pageSize: number; total: number }> { return this.service.list(query); }
  async detail(id: string): Promise<RuleSetVersionResponseDto | null> { return this.service.getById(id); }
  async create(payload: CreateRuleSetVersionRequestDto): Promise<RuleSetVersionResponseDto> { return this.service.create(payload); }
  async update(id: string, payload: UpdateRuleSetVersionRequestDto): Promise<RuleSetVersionResponseDto> { return this.service.update(id, payload); }
  async remove(id: string): Promise<void> { return this.service.remove(id); }
}
