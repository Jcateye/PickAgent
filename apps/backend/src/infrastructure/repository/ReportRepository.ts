import type { ReportRecord } from "../persistence/ReportRecord";
import type { CreateReportRequestDto } from "../../api/dto/CreateReportRequestDto";
import type { UpdateReportRequestDto } from "../../api/dto/UpdateReportRequestDto";
import type { ReportQueryDto } from "../../api/dto/ReportQueryDto";

/** 报告中心主对象表，保存报告列表、来源对象、导出状态和最新版本仓储接口 */
export interface ReportRepository {
  list(query: ReportQueryDto): Promise<{ items: ReportRecord[]; total: number }>;
  getById(id: string): Promise<ReportRecord | null>;
  create(payload: CreateReportRequestDto): Promise<ReportRecord>;
  update(id: string, payload: UpdateReportRequestDto): Promise<ReportRecord>;
  remove(id: string): Promise<void>;
}
