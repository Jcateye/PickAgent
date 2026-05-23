import { finalAgentRuntime, ok } from '../../../_final-api-runtime'

import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from '../../../../../../../contracts/types/businessFoundation.fixture'

function ensurePiSmokeSeed() {
  if (finalAgentRuntime.businessRuntime.store.projections.size > 0) return
  finalAgentRuntime.businessRuntime.ingestService.ingest(businessFoundationSeedFixture)
}

export async function POST() {
  ensurePiSmokeSeed()
  const firstSkuProfileId = Array.from(finalAgentRuntime.businessRuntime.store.projections.keys())[0]
  if (!firstSkuProfileId) {
    throw new Error('Pi smoke requires at least one seeded SKU')
  }

  const { mission, run, session } = finalAgentRuntime.piAdapter.startMission({
    sessionKey: 'pi-smoke-session',
    objective: '验证 Agent 到真实业务工具与 Review Gate 链路',
    sourceSurface: 'agent-copilot',
    autonomyLevel: 'review_required',
  })

  const parsed = finalAgentRuntime.piAdapter.executeTool(run.id, 'parseActivityRules', {
    name: 'Pi Smoke 活动规则',
    platform: 'tmall',
    sourceText: businessFoundationActivityRuleText,
  })
  const ruleSetId = ((parsed.toolCall.outputJson.result as { ruleSetId?: string } | undefined)?.ruleSetId ?? null) as string | null

  const simulated = finalAgentRuntime.piAdapter.executeTool(run.id, 'simulateActivityReadiness', {
    ruleSetId,
    skuProfileIds: [firstSkuProfileId],
    whatIf: { stock: 12 },
  })
  const simulationResultId = ((((simulated.toolCall.outputJson.result as Array<{ simulationResultId?: string }> | undefined) ?? [])[0] ?? {}).simulationResultId ?? null) as string | null

  const explained = finalAgentRuntime.piAdapter.executeTool(run.id, 'explainDecisionWithEvidence', {
    skuProfileId: firstSkuProfileId,
    simulationResultId,
    question: '是否需要进入 Review Gate？',
  })

  const reviewAttempt = finalAgentRuntime.piAdapter.executeTool(run.id, 'createReviewItems', {
    items: [
      {
        skuProfileId: firstSkuProfileId,
        sourceType: 'agent',
        sourceId: simulationResultId ?? run.id,
        question: '是否允许该 SKU 在修复后进入活动准备？',
        recommendation: '先补货并复核模拟证据。',
        riskLevel: 'L2',
        evidence: ((simulated.toolCall.outputJson.result as Array<{ evidence?: unknown[] }> | undefined)?.[0]?.evidence ?? []) as unknown[],
      },
    ],
  })

  const replay = finalAgentRuntime.agentService.listEvents(run.id)

  return ok({
    session,
    mission,
    run,
    piVisibleTools: [...finalAgentRuntime.piAdapter.availableTools],
    disabledRuntimeTools: [...finalAgentRuntime.piAdapter.disabledRuntimeTools],
    toolCalls: [parsed.toolCall, simulated.toolCall, explained.toolCall, reviewAttempt.toolCall],
    reviewGate: reviewAttempt.reviewGate,
    replay,
  })
}
