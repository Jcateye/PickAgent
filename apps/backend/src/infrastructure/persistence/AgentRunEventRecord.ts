/** Agent 运行事件表，保存 Pi lifecycle、assistant delta、tool event 与 review gate 事件以支持 SSE 重放（存储模型） */
export interface AgentRunEventRecord {
  /** 主键 */
  id: string;

  /** Agent Run ID */
  run_id: string;

  /** Run 内递增事件序号 */
  sequence: number;

  /** 事件类型 */
  event_type: string;

  /** 事件阶段 */
  event_phase: string | null;

  /** 事件载荷 JSON */
  payload_json: Record<string, unknown>;

  /** 创建时间 */
  created_at: string;
}
