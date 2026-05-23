import type { AgentToolCall } from "../../domain/entities/AgentToolCall";
import type { AgentToolCallRecord } from "../persistence/AgentToolCallRecord";
import type { AgentToolCallResponseDto } from "../../api/dto/AgentToolCallResponseDto";

/** Agent 工具调用表，保存工具输入输出、状态、风险等级、Review 策略和证据引用映射器 */
export const AgentToolCallMapper = {
  toEntity(record: AgentToolCallRecord): AgentToolCall {
    return {
      id: record.id,
      runId: record.run_id,
      externalToolCallId: record.external_tool_call_id,
      workflowStepId: record.workflow_step_id,
      toolName: record.tool_name,
      status: record.status,
      riskLevel: record.risk_level,
      reviewPolicy: record.review_policy,
      inputJson: record.input_json,
      outputJson: record.output_json,
      evidenceRefsJson: record.evidence_refs_json,
      errorMessage: record.error_message,
      blockedReason: record.blocked_reason,
      startedAt: record.started_at,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  },

  toResponseDto(entity: AgentToolCall): AgentToolCallResponseDto {
    return {
      id: entity.id,
      runId: entity.runId,
      externalToolCallId: entity.externalToolCallId,
      workflowStepId: entity.workflowStepId,
      toolName: entity.toolName,
      status: entity.status,
      riskLevel: entity.riskLevel,
      reviewPolicy: entity.reviewPolicy,
      inputJson: entity.inputJson,
      outputJson: entity.outputJson,
      evidenceRefsJson: entity.evidenceRefsJson,
      errorMessage: entity.errorMessage,
      blockedReason: entity.blockedReason,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  },
};
