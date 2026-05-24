import type { ReportVersionRecord } from "../persistence/ReportVersionRecord";
import type { CreateReportVersionRequestDto } from "../../api/dto/CreateReportVersionRequestDto";
import type { UpdateReportVersionRequestDto } from "../../api/dto/UpdateReportVersionRequestDto";
import type { ReportVersionQueryDto } from "../../api/dto/ReportVersionQueryDto";

/** 报告版本表，保存报告章节、证据快照和导出产物引用仓储接口 */
export interface ReportVersionRepository {
  list(query: ReportVersionQueryDto): Promise<{ items: ReportVersionRecord[]; total: number }>;
  getById(id: string): Promise<ReportVersionRecord | null>;
  create(payload: CreateReportVersionRequestDto): Promise<ReportVersionRecord>;
  update(id: string, payload: UpdateReportVersionRequestDto): Promise<ReportVersionRecord>;
  remove(id: string): Promise<void>;
}
