/** 更新Agent Run Event请求 */
export interface UpdateAgentRunEventRequestDto {
  /** Agent Run ID */
  runId?: string;

  /** Run 内递增事件序号 */
  sequence?: number;

  /** 事件类型 */
  eventType?: string;

  /** 事件阶段 */
  eventPhase?: string | null;

  /** 事件载荷 JSON */
  payloadJson?: Record<string, unknown>;
}
