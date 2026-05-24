import type { ReportCrudService } from "../../application/services/ReportCrudService";
import type { CreateReportRequestDto } from "../dto/CreateReportRequestDto";
import type { UpdateReportRequestDto } from "../dto/UpdateReportRequestDto";
import type { ReportQueryDto } from "../dto/ReportQueryDto";
import type { ReportResponseDto } from "../dto/ReportResponseDto";

/** 报告中心主对象表，保存报告列表、来源对象、导出状态和最新版本控制器骨架 */
export class ReportController {
  constructor(private readonly service: ReportCrudService) {}
  async list(query: ReportQueryDto): Promise<{ items: ReportResponseDto[]; page: number; pageSize: number; total: number }> { return this.service.list(query); }
  async detail(id: string): Promise<ReportResponseDto | null> { return this.service.getById(id); }
  async create(payload: CreateReportRequestDto): Promise<ReportResponseDto> { return this.service.create(payload); }
  async update(id: string, payload: UpdateReportRequestDto): Promise<ReportResponseDto> { return this.service.update(id, payload); }
  async remove(id: string): Promise<void> { return this.service.remove(id); }
}
