import type { ReportVersionCrudService } from "../../application/services/ReportVersionCrudService";
import type { CreateReportVersionRequestDto } from "../dto/CreateReportVersionRequestDto";
import type { UpdateReportVersionRequestDto } from "../dto/UpdateReportVersionRequestDto";
import type { ReportVersionQueryDto } from "../dto/ReportVersionQueryDto";
import type { ReportVersionResponseDto } from "../dto/ReportVersionResponseDto";

/** 报告版本表，保存报告章节、证据快照和导出产物引用控制器骨架 */
export class ReportVersionController {
  constructor(private readonly service: ReportVersionCrudService) {}
  async list(query: ReportVersionQueryDto): Promise<{ items: ReportVersionResponseDto[]; page: number; pageSize: number; total: number }> { return this.service.list(query); }
  async detail(id: string): Promise<ReportVersionResponseDto | null> { return this.service.getById(id); }
  async create(payload: CreateReportVersionRequestDto): Promise<ReportVersionResponseDto> { return this.service.create(payload); }
  async update(id: string, payload: UpdateReportVersionRequestDto): Promise<ReportVersionResponseDto> { return this.service.update(id, payload); }
  async remove(id: string): Promise<void> { return this.service.remove(id); }
}
