import { NextResponse } from 'next/server'

import type { ApiEnvelope } from '../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import { createFinalAgentEventStoreRuntime } from '../../../../backend/src/application/foundation/FinalAgentEventStoreFoundation'
import { createFinalApiPersistenceRuntime, type PrismaPersistenceClient, type ReportRequestDto } from '../../../../backend/src/application/foundation/FinalApiPersistenceFoundation'
import { businessFoundationActivityRuleText, businessFoundationSeedFixture } from '../../../../contracts/types/businessFoundation.fixture'

type FinalApiRuntime = ReturnType<typeof createFinalApiPersistenceRuntime>
type FinalAgentRuntime = ReturnType<typeof createFinalAgentEventStoreRuntime>

declare global {
  // eslint-disable-next-line no-var
  var pickAgentFinalApiRuntime: FinalApiRuntime | undefined
  // eslint-disable-next-line no-var
  var pickAgentFinalAgentRuntime: FinalAgentRuntime | undefined
}

export const dynamic = 'force-dynamic'
export const finalApiRuntime = globalThis.pickAgentFinalApiRuntime ?? createFinalApiRuntime()
globalThis.pickAgentFinalApiRuntime = finalApiRuntime
export const finalAgentRuntime = globalThis.pickAgentFinalAgentRuntime ?? createFinalAgentEventStoreRuntime()
globalThis.pickAgentFinalAgentRuntime = finalAgentRuntime
export const finalReportSnapshotRequest = ensureFinalApiSeed(finalApiRuntime)

export function ok<T>(data: T, requestId = nextRequestId()): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({ code: 'OK', message: 'success', data, requestId })
}

export function fail(code: ApiEnvelope<never>['code'], message: string, status: number, details?: Record<string, unknown>, requestId = nextRequestId()): NextResponse<ApiEnvelope<never>> {
  return NextResponse.json({ code, message, data: null, requestId, details }, { status })
}

export function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function nextRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createFinalApiRuntime(): FinalApiRuntime {
  const adapter = process.env.PICKAGENT_PERSISTENCE_ADAPTER
  const shouldUsePrisma = adapter === 'prisma' || (!adapter && (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL))
  if (!shouldUsePrisma) return createFinalApiPersistenceRuntime({ adapter: 'memory' })
  const requireFromNode = eval('require') as (id: string) => { PrismaClient: new () => PrismaPersistenceClient }
  const { PrismaClient } = requireFromNode('@prisma/client')
  return createFinalApiPersistenceRuntime({ adapter: 'prisma', prisma: new PrismaClient() })
}

async function ensureFinalApiSeed(runtime: FinalApiRuntime): Promise<ReportRequestDto> {
  if (runtime.adapter === 'prisma' || process.env.PICKAGENT_ACCEPTANCE_CLEAN === '1') {
    return {
      type: 'ACTIVITY',
      skuProfileIds: [],
      simulationResultIds: []
    }
  }
  if (runtime.store.projections.size === 0) {
    const ingest = await runtime.ingestService.ingest(businessFoundationSeedFixture)
    const ruleSet = await runtime.activityService.parse({
      name: '618 活动准入规则',
      platform: 'tmall',
      sourceText: businessFoundationActivityRuleText
    })
    const run = await runtime.activityService.simulate(ruleSet.ruleSetId, {
      skuProfileIds: ingest.summaries.map((item) => item.skuProfileId)
    })
    const reviewTarget = run.results.find((item) => item.eligibility !== 'DIRECT_READY') ?? run.results[0]
    if (reviewTarget) {
      await runtime.reviewService.create([
        {
          skuProfileId: reviewTarget.skuProfileId,
          sourceType: 'simulation',
          sourceId: reviewTarget.simulationResultId,
          question: '是否允许该 SKU 在修复后进入活动准备？',
          recommendation: '先按 evidence 修复后，再由 Review 工作台保留人工决策。',
          riskLevel: reviewTarget.eligibility === 'BLOCKED' ? 'L2' : 'L1',
          evidence: reviewTarget.evidence
        }
      ])
    }
  }

  return {
    type: 'ACTIVITY',
    skuProfileIds: Array.from(runtime.store.projections.keys()),
    simulationResultIds: Array.from(runtime.store.simulationResults.keys())
  }
}
