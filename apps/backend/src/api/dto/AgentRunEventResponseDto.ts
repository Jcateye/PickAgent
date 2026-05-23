/** Agent Run Event响应对象 */
export interface AgentRunEventResponseDto {
  /** 主键 */
  id: string;

  /** Agent Run ID */
  runId: string;

  /** Run 内递增事件序号 */
  sequence: number;

  /** 事件类型 */
  eventType: string;

  /** 事件阶段 */
  eventPhase: string | null;

  /** 事件载荷 JSON */
  payloadJson: Record<string, unknown>;

  /** 创建时间 */
  createdAt: string;
}
