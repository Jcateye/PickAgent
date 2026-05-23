'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

type RuleType = 'threshold' | 'field_compare' | 'boolean_block' | 'data_required' | 'quota' | 'manual_review'
type EligibilityStatus = 'DIRECT_READY' | 'REPAIRABLE_READY' | 'MANUAL_REVIEW' | 'BLOCKED'
type HealthStatus = 'READY' | 'REPAIRABLE' | 'WARNING' | 'RISKY' | 'BLOCKED' | 'UNKNOWN'
type WhatIfChangeType = 'restock' | 'price_adjustment' | 'content_fix' | 'certificate_upload'

interface ParsedRuleDto {
  id: string
  type: RuleType
  title: string
  field: string
  operator: string
  value: string
  confidence: number
  evidence: string
}

interface SimulationResultDto {
  id: string
  skuTitle: string
  skuCode: string
  eligibilityStatus: EligibilityStatus
  healthStatus: HealthStatus
  failedRules: Array<{ ruleId: string; reason: string }>
  evidence: Array<{ label: string; value: string }>
  repairSuggestions: string[]
  manualReviewSource?: string
  originalEligibility?: EligibilityStatus
}

interface WhatIfInputDto {
  targetSkuId: string
  changeType: WhatIfChangeType
  value: string
}

interface WhatIfOutputDto {
  beforeStatus: EligibilityStatus
  afterStatus: EligibilityStatus
  diffSummary: string[]
}

interface ActivityWorkbenchResponse {
  source: 'business-foundation-runtime'
  ruleSet: {
    ruleSetId: string
    rules: Array<{
      id: string
      type: RuleType
      field?: string
      operator?: string
      value?: number | string | boolean
      compareField?: string
      message: string
      severity: 'info' | 'warning' | 'blocking'
    }>
    parseStatus: string
    confidence: number
    errors: string[]
  }
  results: Array<{
    simulationResultId: string
    skuProfileId: string
    eligibility: EligibilityStatus
    failedRules: ActivityWorkbenchResponse['ruleSet']['rules']
    evidence: Array<{ type: string; entityId: string; label: string; summary: string }>
    repairSuggestions: string[]
    originalEligibility?: EligibilityStatus
  }>
  skuDetails: Array<{
    skuProfileId: string
    canonicalSkuKey: string
    productName: string
    healthStatus: HealthStatus
    latestSnapshot: {
      stock?: number
      positiveRate?: number
      campaignPrice?: number
      lowestPrice30d?: number
      certificateStatus?: string
    } | null
  }>
  todoNotes: string[]
}

const defaultRuleText = `双11珠宝会场报名规则：
1. 活动库存不得低于 80 件。
2. 活动价必须低于近 30 天最低成交价。
3. 商品必须具备完整材质、克重、证书编号和主图。
4. 已报名互斥活动的 SKU 需要运营人工确认。
5. 每个店铺最多报名 120 个 SKU。`

const parsedRules: ParsedRuleDto[] = [
  {
    id: 'R-001',
    type: 'threshold',
    title: '活动库存门槛',
    field: 'availableStock',
    operator: '>=',
    value: '80',
    confidence: 0.98,
    evidence: '活动库存不得低于 80 件',
  },
  {
    id: 'R-002',
    type: 'field_compare',
    title: '活动价低于 30 天最低成交价',
    field: 'campaignPrice',
    operator: '<',
    value: 'lowestDealPrice30d',
    confidence: 0.93,
    evidence: '活动价必须低于近 30 天最低成交价',
  },
  {
    id: 'R-003',
    type: 'data_required',
    title: '珠宝商品资料完整',
    field: 'material, weight, certificateNo, mainImage',
    operator: 'exists',
    value: 'all',
    confidence: 0.96,
    evidence: '商品必须具备完整材质、克重、证书编号和主图',
  },
  {
    id: 'R-004',
    type: 'manual_review',
    title: '互斥活动人工确认',
    field: 'exclusiveCampaignEnrollment',
    operator: '=',
    value: 'true',
    confidence: 0.88,
    evidence: '已报名互斥活动的 SKU 需要运营人工确认',
  },
]

function mapRule(rule: ActivityWorkbenchResponse['ruleSet']['rules'][number], confidence: number): ParsedRuleDto {
  return {
    id: rule.id,
    type: rule.type,
    title: rule.message,
    field: rule.field ?? rule.compareField ?? 'activityContext',
    operator: rule.operator ?? '=',
    value: rule.value === undefined ? rule.severity : String(rule.value),
    confidence,
    evidence: rule.message,
  }
}

const fallbackSimulationResults: SimulationResultDto[] = [
  {
    id: 'SKU-1001',
    skuTitle: '18K 金钻石项链 0.18ct',
    skuCode: 'TMALL:JWL:1001',
    eligibilityStatus: 'DIRECT_READY',
    healthStatus: 'READY',
    failedRules: [],
    evidence: [
      { label: '可售库存', value: '126 件' },
      { label: '活动价 / 30 天最低价', value: '3280 / 3490' },
      { label: '证书编号', value: 'GIA-73A91' },
    ],
    repairSuggestions: ['无需修复，可进入报名清单。'],
  },
  {
    id: 'SKU-1002',
    skuTitle: '足金转运珠手链',
    skuCode: 'JD:JWL:1002',
    eligibilityStatus: 'REPAIRABLE_READY',
    healthStatus: 'REPAIRABLE',
    failedRules: [{ ruleId: 'R-001', reason: '当前可售库存 52 件，低于 80 件门槛。' }],
    evidence: [
      { label: '可售库存', value: '52 件' },
      { label: '在途库存', value: '40 件，预计 2 天到仓' },
      { label: '资料完整度', value: '100%' },
    ],
    repairSuggestions: ['补货至少 28 件后重跑模拟。', '活动报名前确认仓库入库状态。'],
  },
  {
    id: 'SKU-1003',
    skuTitle: '培育钻戒经典六爪款',
    skuCode: 'TMALL:JWL:1003',
    eligibilityStatus: 'MANUAL_REVIEW',
    healthStatus: 'RISKY',
    failedRules: [{ ruleId: 'R-004', reason: '已存在 520 主题活动报名记录。' }],
    evidence: [
      { label: '互斥活动', value: '520 主题活动' },
      { label: '活动结束时间', value: '2026-06-18 23:59' },
      { label: '风险来源', value: '平台互斥规则' },
    ],
    repairSuggestions: ['运营确认是否退出原活动。', '由 Review 工作台处理正式审批，不在本页决策。'],
    manualReviewSource: 'exclusiveCampaignEnrollment',
  },
  {
    id: 'SKU-1004',
    skuTitle: '彩宝吊坠礼盒款',
    skuCode: 'AMZ:JWL:1004',
    eligibilityStatus: 'BLOCKED',
    healthStatus: 'BLOCKED',
    failedRules: [
      { ruleId: 'R-002', reason: '活动价 899 高于近 30 天最低成交价 859。' },
      { ruleId: 'R-003', reason: '缺少证书编号与主图。' },
    ],
    evidence: [
      { label: '活动价 / 30 天最低价', value: '899 / 859' },
      { label: '证书编号', value: '缺失' },
      { label: '主图', value: '缺失' },
    ],
    repairSuggestions: ['重新定价至 858 以下。', '补齐证书编号和主图后再重跑模拟。'],
  },
]

const statusCopy: Record<EligibilityStatus, { label: string; tone: 'ready' | 'warning' | 'review' | 'blocked' }> = {
  DIRECT_READY: { label: '可直接报名', tone: 'ready' },
  REPAIRABLE_READY: { label: '修复后可报名', tone: 'warning' },
  MANUAL_REVIEW: { label: '需人工确认', tone: 'review' },
  BLOCKED: { label: '阻断', tone: 'blocked' },
}

function createMockWhatIfOutput(input: WhatIfInputDto): WhatIfOutputDto {
  const target = fallbackSimulationResults.find((item) => item.id === input.targetSkuId) ?? fallbackSimulationResults[1]

  if (input.changeType === 'restock' && target.id === 'SKU-1002') {
    return {
      beforeStatus: target.eligibilityStatus,
      afterStatus: Number(input.value) >= 28 ? 'DIRECT_READY' : 'REPAIRABLE_READY',
      diffSummary:
        Number(input.value) >= 28
          ? ['库存缺口已补足，R-001 从失败变为通过。', '活动准入状态从修复后可报名变为可直接报名。']
          : ['库存仍未达到 80 件门槛，保持修复后可报名。'],
    }
  }

  if (input.changeType === 'content_fix' && target.id === 'SKU-1004') {
    return {
      beforeStatus: target.eligibilityStatus,
      afterStatus: 'REPAIRABLE_READY',
      diffSummary: ['资料完整性规则 R-003 已修复。', '价格规则 R-002 仍失败，需要继续调整活动价。'],
    }
  }

  return {
    beforeStatus: target.eligibilityStatus,
    afterStatus: target.eligibilityStatus,
    diffSummary: ['mock 场景未命中明确状态变化，保留原准入结论。'],
  }
}

export function ActivitiesPage() {
  const [ruleText, setRuleText] = useState(defaultRuleText)
  const [parsedRuleItems, setParsedRuleItems] = useState(parsedRules)
  const [simulationItems, setSimulationItems] = useState<SimulationResultDto[]>(fallbackSimulationResults)
  const [adapterState, setAdapterState] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [adapterNotes, setAdapterNotes] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState(fallbackSimulationResults[1].id)
  const [whatIfOutput, setWhatIfOutput] = useState<WhatIfOutputDto>(createMockWhatIfOutput({ targetSkuId: fallbackSimulationResults[1].id, changeType: 'restock', value: '28' }))
  const [whatIfInput, setWhatIfInput] = useState<WhatIfInputDto>({
    targetSkuId: fallbackSimulationResults[1].id,
    changeType: 'restock',
    value: '28',
  })

  useEffect(() => {
    let cancelled = false

    async function loadWorkbench() {
      try {
        const response = await fetch('/api/activity-workbench', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceText: ruleText }),
        })
        if (!response.ok) throw new Error(`activity-workbench failed: ${response.status}`)
        const data = (await response.json()) as ActivityWorkbenchResponse
        if (cancelled) return
        const detailsById = new Map(data.skuDetails.map((item) => [item.skuProfileId, item]))
        const mappedResults = data.results.map((result) => mapSimulationResult(result, detailsById.get(result.skuProfileId)))
        setParsedRuleItems(data.ruleSet.rules.map((rule) => mapRule(rule, data.ruleSet.confidence)))
        setSimulationItems(mappedResults)
        setAdapterNotes(data.todoNotes)
        setSelectedId((current) => mappedResults.some((item) => item.id === current) ? current : mappedResults[0]?.id ?? current)
        setWhatIfInput((current) => ({ ...current, targetSkuId: mappedResults[0]?.id ?? current.targetSkuId }))
        setAdapterState('ready')
      } catch (error) {
        if (cancelled) return
        setAdapterState('fallback')
        setAdapterNotes([error instanceof Error ? error.message : 'activity-workbench adapter failed; using mock fallback'])
      }
    }

    const timer = window.setTimeout(loadWorkbench, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [ruleText])

  useEffect(() => {
    let cancelled = false

    async function runWhatIf() {
      if (adapterState !== 'ready') {
        setWhatIfOutput(createMockWhatIfOutput(whatIfInput))
        return
      }
      try {
        const response = await fetch('/api/activity-workbench', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceText: ruleText, whatIf: toServiceWhatIf(whatIfInput) }),
        })
        if (!response.ok) throw new Error(`activity-workbench what-if failed: ${response.status}`)
        const data = (await response.json()) as ActivityWorkbenchResponse
        if (cancelled) return
        const result = data.results[0]
        setWhatIfOutput({
          beforeStatus: result?.originalEligibility ?? result?.eligibility ?? 'MANUAL_REVIEW',
          afterStatus: result?.eligibility ?? 'MANUAL_REVIEW',
          diffSummary: result?.originalEligibility && result.originalEligibility !== result.eligibility
            ? [`ActivitySimulationService 已重跑 what-if：${result.originalEligibility} -> ${result.eligibility}。`]
            : ['ActivitySimulationService 已重跑 what-if，准入状态未发生变化。'],
        })
      } catch {
        if (cancelled) return
        setWhatIfOutput(createMockWhatIfOutput(whatIfInput))
      }
    }

    runWhatIf()
    return () => {
      cancelled = true
    }
  }, [adapterState, ruleText, whatIfInput])

  const selectedResult = simulationItems.find((item) => item.id === selectedId) ?? simulationItems[0]
  const groupedResults = useMemo(
    () =>
      simulationItems.reduce<Record<EligibilityStatus, SimulationResultDto[]>>(
        (groups, item) => {
          groups[item.eligibilityStatus].push(item)
          return groups
        },
        { DIRECT_READY: [], REPAIRABLE_READY: [], MANUAL_REVIEW: [], BLOCKED: [] },
      ),
    [simulationItems],
  )

  return (
    <div className="pageStack activityWorkbench">
      <PageHeader
        title="活动规则与准入模拟"
        description={`Layer 3 接入 BusinessFoundation ActivityRuleService / ActivitySimulationService；当前状态：${adapterState === 'ready' ? '真实接入' : adapterState === 'loading' ? '加载中' : 'mock fallback'}`}
      />

      <div className="activityAuthoringGrid">
        <Panel>
          <PanelHeader title="规则录入" description="用户粘贴平台活动规则，原文作为后续 evidence 的上下文保留。" />
          <PanelBody className="activityInputBody">
            <label className="fieldLabel" htmlFor="activity-rule-text">
              活动规则原文
            </label>
            <textarea
              id="activity-rule-text"
              value={ruleText}
              onChange={(event) => setRuleText(event.target.value)}
              aria-label="活动规则原文"
            />
            <div className="activityContractNote">
              <span>Parse adapter</span>
              <code>RuleTextInputDto -&gt; ActivityRuleService.parseRules</code>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="结构化规则" description="消费真实 Canonical Rule DSL；manual_review 只显示来源提示，正式审批交给 Review 工作台。" />
          <PanelBody className="structuredRuleList">
            {parsedRuleItems.map((rule) => (
              <article className="structuredRuleItem" key={rule.id}>
                <div className="ruleItemTopline">
                  <div>
                    <strong>{rule.title}</strong>
                    <code>{rule.id}</code>
                  </div>
                  <StatusBadge tone="neutral">{rule.type}</StatusBadge>
                </div>
                <dl className="ruleFieldGrid">
                  <div>
                    <dt>字段</dt>
                    <dd>{rule.field}</dd>
                  </div>
                  <div>
                    <dt>条件</dt>
                    <dd>
                      {rule.operator} {rule.value}
                    </dd>
                  </div>
                  <div>
                    <dt>置信度</dt>
                    <dd>{Math.round(rule.confidence * 100)}%</dd>
                  </div>
                </dl>
                <p className="evidenceLine">{rule.evidence}</p>
              </article>
            ))}
          </PanelBody>
        </Panel>
      </div>

      <section className="activityStatusGrid" aria-label="模拟结果状态分组">
        {(Object.keys(groupedResults) as EligibilityStatus[]).map((status) => (
          <button className="statusSummaryTile" key={status} onClick={() => setSelectedId(groupedResults[status][0]?.id ?? selectedId)}>
            <span>{statusCopy[status].label}</span>
            <strong>{groupedResults[status].length}</strong>
            <StatusBadge tone={statusCopy[status].tone}>{status}</StatusBadge>
          </button>
        ))}
      </section>

      <div className="activityResultGrid">
        <Panel>
          <PanelHeader title="模拟对象列表" description="按活动准入状态查看对象入口；健康状态只读展示，不在本页重算。" />
          <PanelBody className="simulationList">
            {simulationItems.map((item) => (
              <button
                className={`simulationRow ${item.id === selectedResult.id ? 'simulationRow--active' : ''}`}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id)
                  setWhatIfInput((current) => ({ ...current, targetSkuId: item.id }))
                }}
              >
                <span>
                  <strong>{item.skuTitle}</strong>
                  <code>{item.skuCode}</code>
                </span>
                <StatusBadge tone={statusCopy[item.eligibilityStatus].tone}>{statusCopy[item.eligibilityStatus].label}</StatusBadge>
              </button>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="对象详情" description="失败规则、证据摘要和修复建议用于运营判断；正式审批交给 Review 工作台。" />
          <PanelBody className="simulationDetail">
            <div className="detailTitleRow">
              <div>
                <h3>{selectedResult.skuTitle}</h3>
                <code>{selectedResult.skuCode}</code>
              </div>
              <StatusBadge tone={statusCopy[selectedResult.eligibilityStatus].tone}>
                {statusCopy[selectedResult.eligibilityStatus].label}
              </StatusBadge>
            </div>
            <dl className="detailMetaGrid">
              <div>
                <dt>活动准入状态</dt>
                <dd>{selectedResult.eligibilityStatus}</dd>
              </div>
              <div>
                <dt>长期健康状态</dt>
                <dd>{selectedResult.healthStatus}</dd>
              </div>
              <div>
                <dt>Review 来源</dt>
                <dd>{selectedResult.manualReviewSource ?? '无'}</dd>
              </div>
            </dl>
            <DetailBlock title="失败规则">
              {selectedResult.failedRules.length ? (
                selectedResult.failedRules.map((rule) => (
                  <li key={rule.ruleId}>
                    <code>{rule.ruleId}</code>
                    <span>{rule.reason}</span>
                  </li>
                ))
              ) : (
                <li>无失败规则。</li>
              )}
            </DetailBlock>
            <DetailBlock title="证据摘要">
              {selectedResult.evidence.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </DetailBlock>
            <DetailBlock title="修复建议">
              {selectedResult.repairSuggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </DetailBlock>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="What-if 模拟" description="通过 ActivitySimulationService 重跑指定变更；输出只改变活动准入结论，不写回健康诊断。" />
        <PanelBody className="whatIfBody">
          <div className="whatIfControls">
            <label>
              <span className="fieldLabel">对象</span>
              <select value={whatIfInput.targetSkuId} onChange={(event) => setWhatIfInput((current) => ({ ...current, targetSkuId: event.target.value }))}>
                {simulationItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.skuCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="fieldLabel">变更类型</span>
              <select
                value={whatIfInput.changeType}
                onChange={(event) => setWhatIfInput((current) => ({ ...current, changeType: event.target.value as WhatIfChangeType }))}
              >
                <option value="restock">补货</option>
                <option value="price_adjustment">改价</option>
                <option value="content_fix">资料修复</option>
                <option value="certificate_upload">上传证书</option>
              </select>
            </label>
            <label>
              <span className="fieldLabel">变更值</span>
              <input value={whatIfInput.value} onChange={(event) => setWhatIfInput((current) => ({ ...current, value: event.target.value }))} />
            </label>
          </div>
          <div className="whatIfCompare">
            <div>
              <span>原始状态</span>
              <StatusBadge tone={statusCopy[whatIfOutput.beforeStatus].tone}>{statusCopy[whatIfOutput.beforeStatus].label}</StatusBadge>
            </div>
            <div>
              <span>变更后状态</span>
              <StatusBadge tone={statusCopy[whatIfOutput.afterStatus].tone}>{statusCopy[whatIfOutput.afterStatus].label}</StatusBadge>
            </div>
            <ul>
              {whatIfOutput.diffSummary.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </PanelBody>
      </Panel>
      {adapterNotes.length ? (
        <Panel>
          <PanelHeader title="接入说明" description="Layer 2 TODO 中与活动模拟相关的处理状态。" />
          <PanelBody>
            <ul>
              {adapterNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  )
}

function mapSimulationResult(result: ActivityWorkbenchResponse['results'][number], detail: ActivityWorkbenchResponse['skuDetails'][number] | undefined): SimulationResultDto {
  const snapshot = detail?.latestSnapshot
  return {
    id: result.skuProfileId,
    skuTitle: detail?.productName ?? result.skuProfileId,
    skuCode: detail?.canonicalSkuKey ?? result.skuProfileId,
    eligibilityStatus: result.eligibility,
    healthStatus: detail?.healthStatus ?? 'UNKNOWN',
    failedRules: result.failedRules.map((rule) => ({ ruleId: rule.id, reason: rule.message })),
    evidence: [
      ...(snapshot ? [
        { label: '可售库存', value: snapshot.stock === undefined ? '缺失' : `${snapshot.stock} 件` },
        { label: '好评率', value: snapshot.positiveRate === undefined ? '缺失' : `${Math.round(snapshot.positiveRate * 100)}%` },
        { label: '证书状态', value: snapshot.certificateStatus ?? '缺失' },
      ] : []),
      ...result.evidence.map((item) => ({ label: item.label, value: item.summary })),
    ],
    repairSuggestions: result.repairSuggestions.length ? result.repairSuggestions : ['当前无修复建议。'],
    manualReviewSource: result.failedRules.find((rule) => rule.type === 'manual_review')?.id,
    originalEligibility: result.originalEligibility,
  }
}

function toServiceWhatIf(input: WhatIfInputDto) {
  if (input.changeType === 'restock') return { targetSkuId: input.targetSkuId, stock: Number(input.value) }
  if (input.changeType === 'price_adjustment') return { targetSkuId: input.targetSkuId, campaignPrice: Number(input.value) }
  if (input.changeType === 'certificate_upload') return { targetSkuId: input.targetSkuId, certificateStatus: input.value || 'valid' }
  return { targetSkuId: input.targetSkuId, certificateStatus: 'valid' }
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="detailBlock">
      <h4>{title}</h4>
      <ul>{children}</ul>
    </section>
  )
}
