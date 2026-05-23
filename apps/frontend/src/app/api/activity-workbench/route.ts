import { NextResponse } from 'next/server'

import type { CanonicalRuleDto, SimulationResultDto, SkuDetailDto } from '../../../../../contracts/types/businessFoundation'
import { businessFoundationSeedFixture } from '../../../../../contracts/types/businessFoundation.fixture'
import { createBusinessFoundationRuntime } from '../../../../../backend/src/application/foundation/BusinessFoundationServices'

interface ActivityWorkbenchRequest {
  sourceText?: string
  whatIf?: {
    targetSkuId?: string
    stock?: number
    campaignPrice?: number
    certificateStatus?: string
  }
}

interface ActivityWorkbenchResponse {
  source: 'business-foundation-runtime'
  ruleSet: {
    ruleSetId: string
    name: string
    platform?: string
    sourceText: string
    rules: CanonicalRuleDto[]
    parseStatus: string
    confidence: number
    errors: string[]
  }
  results: SimulationResultDto[]
  skuDetails: SkuDetailDto[]
  todoNotes: string[]
}

const runtime = createBusinessFoundationRuntime()
const seededSummaries = runtime.ingestService.ingest(businessFoundationSeedFixture).summaries

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as ActivityWorkbenchRequest
  const sourceText = payload.sourceText?.trim() || '活动库存不少于 20，好评率不少于 92%，证书状态必须有效。'
  const ruleSet = runtime.activityRuleService.parseRules({
    name: '员工工作台活动规则',
    platform: 'workbench',
    sourceText,
  })
  const targetIds = seededSummaries.map((item) => item.skuProfileId)
  const simulationTargetIds = payload.whatIf?.targetSkuId ? [payload.whatIf.targetSkuId] : targetIds
  const whatIf = payload.whatIf ? { stock: payload.whatIf.stock, campaignPrice: payload.whatIf.campaignPrice, certificateStatus: payload.whatIf.certificateStatus } : undefined
  const results = runtime.activitySimulationService.runSimulation({
    ruleSetId: ruleSet.ruleSetId,
    skuProfileIds: simulationTargetIds,
    whatIf,
  })
  const skuDetails = targetIds.map((id) => runtime.skuQueryService.getSkuDetail(id)).filter((item): item is SkuDetailDto => item !== null)

  const response: ActivityWorkbenchResponse = {
    source: 'business-foundation-runtime',
    ruleSet,
    results,
    skuDetails,
    todoNotes: [
      '价格字段缺口仍按 Layer 2 TODO 记录：当前 seed/抖店库存主接口不能证明活动价来源。',
      'business_chance_center 已作为 manual_review DSL 上下文处理，不在活动页做正式审批。',
    ],
  }

  return NextResponse.json(response)
}
