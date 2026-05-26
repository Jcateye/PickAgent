'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Play, FileText, AlertTriangle, ChevronDown, MoreHorizontal, CheckSquare, RefreshCw } from 'lucide-react'
import type { ActivityRuleSetDto, CanonicalRuleDto, ReviewItemDto, RuleSetDetailDto, SimulationResultDto } from '../../../../contracts/types/businessFoundation'
import type { ActivityExecutionPlanDto } from '../../../../contracts/types/activityManagement'
import type { DashboardSkuListItemDto } from '../../../../contracts/types/dashboardSkuReadModels'
import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import type { WorkbenchContext } from '@/modules/agent-copilot/types'
import { fetchActivityApi } from './api-client'
import styles from './rule-execution.module.css'

interface ActivitySimulationRunDto {
  simulationRunId: string
  activityRuleSetId: string
  status: 'SUCCEEDED'
  scope: { skuProfileIds: string[] }
  results: SimulationResultDto[]
  startedAt: string
  completedAt: string
  workflowRunId?: string
}

interface DashboardSkuPageDto {
  items: DashboardSkuListItemDto[]
  total: number
}

export function RuleExecutionPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [actionLink, setActionLink] = useState<{ href: string; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [ruleName, setRuleName] = useState('活动规则执行路径')
  const [platform, setPlatform] = useState('tmall')
  const [sourceText, setSourceText] = useState(defaultRuleSourceText)
  const [ruleSet, setRuleSet] = useState<ActivityRuleSetDto | null>(null)
  const [simulationRun, setSimulationRun] = useState<ActivitySimulationRunDto | null>(null)
  const [activityId, setActivityId] = useState<string | null>(() => getInitialRuleExecutionParam('activityId'))
  const [candidateSkuProfileIds, setCandidateSkuProfileIds] = useState<string[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>(['stock', 'price', 'brand_conflict'])

  useEffect(() => {
    const activityId = getInitialRuleExecutionParam('activityId')
    const ruleSetId = getInitialRuleExecutionParam('ruleSetId')
    const simulationRunId = getInitialRuleExecutionParam('simulationRunId')
    if (activityId) {
      let cancelled = false
      setBusy(true)
      setActivityId(activityId)
      fetchActivityApi<ActivityExecutionPlanDto>(`/api/activities/${activityId}/execution-plan`)
        .then(async (plan) => {
          if (cancelled) return
          const rules = plan.ruleSet.rules
          const restoredRuleSet = activityPlanToRuleSet(plan)
          setRuleSet(restoredRuleSet)
          setRuleName(restoredRuleSet.name)
          setPlatform('activity')
          setSourceText(rules.map((rule) => rule.message).join('\n') || defaultRuleSourceText)
          setCandidateSkuProfileIds(plan.candidateSkuProfileIds ?? [])
          if (plan.ruleSet.ruleSetId && plan.runId) {
            const run = await fetchActivityApi<ActivitySimulationRunDto>(`/api/rule-sets/${plan.ruleSet.ruleSetId}/simulations/${plan.runId}`)
            if (cancelled) return
            setSimulationRun(run)
          }
          setMessage(`已恢复活动执行计划：${activityId}${plan.runId ? ` / ${plan.runId}` : ''}`)
          syncRuleExecutionUrl(plan.ruleSet.ruleSetId, plan.runId, activityId)
        })
        .catch((error: unknown) => {
          if (!cancelled) setMessage(error instanceof Error ? error.message : '恢复活动执行计划失败')
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
      return () => {
        cancelled = true
      }
    }
    if (!ruleSetId || !simulationRunId) return
    let cancelled = false
    setBusy(true)
    Promise.all([
      fetchActivityApi<RuleSetDetailDto>(`/api/rule-sets/${ruleSetId}`),
      fetchActivityApi<ActivitySimulationRunDto>(`/api/rule-sets/${ruleSetId}/simulations/${simulationRunId}`),
    ])
      .then(([detail, run]) => {
        if (cancelled) return
        setRuleSet(ruleSetDetailToActivityRuleSet(detail))
        setRuleName(detail.name)
        setSourceText(detail.sourceText)
        setSimulationRun(run)
        setMessage(`已恢复运行检查：${run.simulationRunId}，模拟 ${run.results.length} 个 SKU。`)
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : '恢复规则执行结果失败')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runCheck() {
    setBusy(true)
    setActionLink(null)
    try {
      const parsedRuleSet = await fetchActivityApi<ActivityRuleSetDto>('/api/activities/parse', {
        method: 'POST',
        body: JSON.stringify({
          name: ruleName.trim() || '活动规则执行路径',
          platform: platform.trim() || 'internal',
          sourceText: sourceText.trim(),
        }),
      })
      const skuPage = await fetchActivityApi<DashboardSkuPageDto>('/api/skus?page=1&pageSize=8')
      const skuProfileIds = skuPage.items.map((item) => item.skuProfileId)
      if (!skuProfileIds.length) throw new Error('没有可模拟的 SKU 数据')
      const run = await fetchActivityApi<ActivitySimulationRunDto>(`/api/rule-sets/${encodeURIComponent(parsedRuleSet.ruleSetId)}/simulations`, {
        method: 'POST',
        body: JSON.stringify({ skuProfileIds }),
      })
      setRuleSet(parsedRuleSet)
      setSimulationRun(run)
      syncRuleExecutionUrl(parsedRuleSet.ruleSetId, run.simulationRunId)
      setMessage(`运行检查已完成：${run.simulationRunId}，模拟 ${run.results.length} 个 SKU，阻断 ${run.results.filter((item) => item.eligibility === 'BLOCKED').length} 个。`)
      setActionLink({ href: runConsoleHref(run.workflowRunId ?? run.simulationRunId), label: '查看模拟 Run' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '运行检查失败')
    } finally {
      setBusy(false)
    }
  }

  async function saveRuleSetToLibrary() {
    setBusy(true)
    setActionLink(null)
    try {
      const saved = await fetchActivityApi<RuleSetDetailDto>('/api/rule-sets', {
        method: 'POST',
        body: JSON.stringify({
          name: ruleSet?.name ?? (ruleName.trim() || '活动规则执行路径'),
          platform: ruleSet?.platform ?? (platform.trim() || 'internal'),
          sourceText: ruleSet?.sourceText ?? sourceText.trim(),
          rules: structuredRules,
          type: 'ACTIVITY_RULE',
          source: 'INTERNAL',
          status: 'DRAFT',
        }),
      })
      setMessage(`已保存到规则库：${saved.name} / ${saved.ruleSetId}`)
      setActionLink({
        href: saved.workflowRunId ? runConsoleHref(saved.workflowRunId) : ruleLibraryHref(saved.ruleSetId),
        label: saved.workflowRunId ? '查看保存 Run' : '查看规则集',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存规则集失败')
    } finally {
      setBusy(false)
    }
  }

  async function createChecklistReviews(action: 'assign' | 'mark') {
    const selectedItems = checklistItems.filter((item) => selectedChecks.includes(item.id))
    if (!selectedItems.length) {
      setMessage('请先选择检查项')
      return
    }
    setBusy(true)
    setActionLink(null)
    try {
      const created = await fetchActivityApi<ReviewItemDto[]>('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            sourceType: 'agent',
            sourceId: item.id,
            question: action === 'assign' ? `指派处理检查项：${item.label}` : `确认检查项已完成：${item.label}`,
            recommendation: action === 'assign' ? `${item.owner} 跟进 ${item.requiredData}` : `复核 ${item.requiredData} 后标记为完成`,
            riskLevel: item.status === 'missing' || item.status === 'pending' ? 'L2' : 'L1',
            evidence: [
              {
                type: 'rule',
                entityId: ruleSet?.ruleSetId ?? item.id,
                label: item.label,
                summary: `${item.requiredData} / ${item.source} / ${item.method}`,
              },
            ],
          })),
        }),
      })
      if (action === 'mark') {
        await Promise.all(created.map((item) => fetchActivityApi(`/api/reviews/${item.reviewItemId}/decision`, {
          method: 'POST',
          body: JSON.stringify({
            decision: 'APPROVE',
            decisionBy: 'rule_execution_page',
            decisionComment: '批量确认检查项已完成：来自规则执行页',
          }),
        })))
      }
      setMessage(`${action === 'assign' ? '批量指派已生成待审批 Review' : '批量确认已生成并批准 Review'}：${created.map((item) => item.reviewItemId).join(', ')}`)
      if (created[0]) {
        setActionLink({
          href: reviewApprovalHref(created[0].reviewItemId),
          label: created.length > 1 ? `查看首个 Review（共 ${created.length} 个）` : '查看 Review',
        })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批量操作失败')
    } finally {
      setBusy(false)
    }
  }

  function toggleCheck(id: string) {
    setSelectedChecks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleAllChecks() {
    setSelectedChecks((current) => current.length === checklistItems.length ? [] : checklistItems.map((item) => item.id))
  }

  const structuredRules = ruleSet?.rules.length ? ruleSet.rules : defaultStructuredRules
  const checklistItems = buildChecklistItems(structuredRules, simulationRun?.results ?? [], activityId)
  const requirementSummary = summarizeRequirements(checklistItems)
  const statusSummary = summarizeChecklistStatus(checklistItems)
  const uncertainItems = checklistItems.filter((item) => item.status === 'pending')
  const ruleSourceTitle = formatRuleSourceTitle(ruleSet?.name ?? ruleName, ruleSet?.platform ?? platform)
  const createdByLabel = ruleSet ? '规则解析 API' : '当前编辑草稿'
  const agentContext = useMemo<WorkbenchContext>(() => ({
    route: '/rule-execution',
    pageTitle: '规则执行',
    selectedEntity: simulationRun
      ? { entityType: 'simulationRun', entityId: simulationRun.simulationRunId, label: `模拟运行 ${simulationRun.simulationRunId}` }
      : { entityType: 'activityRuleSet', entityId: ruleSet?.ruleSetId ?? 'rule-execution', label: ruleSet?.name ?? ruleName },
    visibleFilters: { platform, selectedChecks, hasSimulationRun: Boolean(simulationRun), ruleSetId: ruleSet?.ruleSetId, activityId, candidateSkuCount: candidateSkuProfileIds.length },
    visibleColumns: ['checkItem', 'status', 'owner', 'requiredData', 'method'],
  }), [activityId, candidateSkuProfileIds.length, platform, ruleName, ruleSet?.name, ruleSet?.ruleSetId, selectedChecks, simulationRun])

  return (
    <>
    <WorkbenchContextRegistration context={agentContext} />
    <div className="pageStack">
      <div className="pageHeader" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px' }}>{ruleSet?.name ?? ruleName}</h1>
            <span className="statusBadge statusBadge--ready" style={{ fontSize: '12px' }}>{ruleSet ? '✓ 已解析' : '待运行'}</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
            <span>规则版本: {ruleSet?.ruleSetId ? ruleSet.ruleSetId.slice(0, 8) : '待运行'}</span>
            <span>来源: {createdByLabel}</span>
            <span>创建时间: {simulationRun ? new Date(simulationRun.startedAt).toLocaleString('zh-CN') : '待运行'}</span>
            <span>适用范围: {simulationRun ? `已模拟 SKU (${simulationRun.results.length})` : '运行后读取真实 SKU'}</span>
            {activityId ? <span>候选清单: <a href={skuAccessHref(candidateSkuProfileIds[0], activityId)} style={{ color: 'var(--primary)' }}>{candidateSkuProfileIds.length} 个 SKU</a></span> : null}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="primaryButton" type="button" onClick={() => void runCheck()} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Play size={16} /> 运行检查
          </button>
          <a className="secondaryButton" href={simulationRun ? runConsoleHref(simulationRun.workflowRunId ?? simulationRun.simulationRunId) : '/run-console'} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} /> 查看 Run
          </a>
          <button className="iconButton" type="button" onClick={() => void saveRuleSetToLibrary()} disabled={busy} title="保存到规则库">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
      {message ? (
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          {message}
          {actionLink ? <> · <a href={actionLink.href} style={{ color: 'var(--primary)', fontWeight: 600 }}>{actionLink.label}</a></> : null}
        </div>
      ) : null}

      <div className="twoColumnScaffold">
        <div className="twoColumnMain" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="panel">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <div className={styles.numberCircle}>1</div>
                规则原文
              </div>
              <a href="/rule-library" style={{ color: 'var(--primary)', fontSize: '13px' }}>查看完整规则 ↗</a>
            </div>
            <div className={styles.sectionBody}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>{ruleSourceTitle}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '12px', marginBottom: '12px' }}>
                <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} aria-label="规则名称" style={{ height: '36px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px' }} />
                <input value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="平台" style={{ height: '36px', border: '1px solid var(--line)', borderRadius: '6px', padding: '0 10px' }} />
              </div>
              <textarea
                className={styles.originalRuleText}
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                rows={5}
                aria-label="规则原文"
                style={{ width: '100%', resize: 'vertical', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px' }}
              />
              <p className={styles.originalRuleMuted}>不满足或无法验证的数据项将影响报名结果。</p>
            </div>
          </div>

          <div className="panel">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <div className={styles.numberCircle}>2</div>
                结构化规则
              </div>
            </div>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>规则 ID</th>
                  <th>字段</th>
                  <th>条件</th>
                  <th>类型</th>
                  <th>置信度</th>
                  <th>证据</th>
                </tr>
              </thead>
              <tbody>
                {structuredRules.map((rule) => {
                  const evidenceHref = ruleEvidenceHref(rule, simulationRun?.results ?? [], activityId)
                  return (
                    <tr key={rule.id}>
                      <td>{rule.id}</td>
                      <td>{rule.field ?? rule.compareField ?? '-'}</td>
                      <td>{ruleCondition(rule)}</td>
                      <td>{ruleTypeLabel(rule.type, rule.severity)}</td>
                      <td className={(ruleSet?.confidence ?? 0.9) >= 0.9 ? styles.highConfidence : styles.medConfidence}>{confidenceLabel(ruleSet?.confidence ?? 0.9)}</td>
                      <td><a href={evidenceHref} style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
              <span>共 {structuredRules.length} 条</span>
              <button type="button" onClick={() => setMessage('置信度来自规则解析 API 的 confidence 字段；低置信度应进入 Review。')} style={{ color: 'var(--muted)', border: 0, background: 'transparent' }}>置信度说明 ⓘ</button>
            </div>
          </div>

          <div className="panel">
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitle}>
                <div className={styles.numberCircle}>3</div>
                执行检查清单 <span style={{ color: 'var(--muted)', fontWeight: 'normal', fontSize: '13px', marginLeft: '8px' }}>(默认视图: 结论与下一步)</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="secondaryButton" type="button" onClick={() => void createChecklistReviews('assign')} disabled={busy} style={{ height: '32px', fontSize: '13px' }}>批量指派</button>
                <button className="secondaryButton" type="button" onClick={() => void createChecklistReviews('mark')} disabled={busy} style={{ height: '32px', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <CheckSquare size={14} style={{ marginRight: '6px' }} /> 批量确认 Review
                </button>
                <button className="iconButton" type="button" onClick={() => void runCheck()} style={{ height: '32px', width: '32px' }}><RefreshCw size={14} /></button>
              </div>
            </div>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" checked={selectedChecks.length === checklistItems.length} onChange={toggleAllChecks} /></th>
                  <th>检查项</th>
                  <th>所需数据</th>
                  <th>数据来源</th>
                  <th>判断方式</th>
                  <th>当前状态</th>
                  <th>责任人</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {checklistItems.map((item) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" checked={selectedChecks.includes(item.id)} onChange={() => toggleCheck(item.id)} /></td>
                    <td><FileText size={14} style={{ marginRight: '6px', color: 'var(--primary)', verticalAlign: 'middle' }}/> {item.label}</td>
                    <td>{item.requiredData}</td>
                    <td>{item.source}</td>
                    <td>{item.method}</td>
                    <td>{renderChecklistStatus(item.status, styles)}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width:'20px', height:'20px', background:'#eee', borderRadius:'50%'}}></div>{item.owner}</div></td>
                    <td><a href={item.actionHref} style={{ color: 'var(--primary)' }}>{item.actionLabel}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
              <span>共 {checklistItems.length} 条</span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ color: 'var(--ready)' }}>● 已完成 {statusSummary.ready}</span>
                <span style={{ color: 'var(--blocked)' }}>● 缺少数据 {statusSummary.missing}</span>
                <span style={{ color: '#d4a017' }}>● 待确认 {statusSummary.pending}</span>
                <span>● 阻塞 {statusSummary.blocked}</span>
              </div>
            </div>
          </div>

        </div>

        <div className="twoColumnSide" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="panel">
            <div className={styles.sectionHeader} style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>数据需求 (共 {checklistItems.length} 项)</div>
              <a href="/data-sources" style={{ fontSize: '13px', color: 'var(--primary)' }}>查看全部</a>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.dataRequirementGrid}>
                <div className={`${styles.reqBox} ${styles.ready}`}>
                  <div className={styles.reqTitle}>已就绪</div>
                  <div className={styles.reqValue} style={{ color: 'var(--ready)' }}>{requirementSummary.ready}</div>
                </div>
                <div className={`${styles.reqBox} ${styles.missing}`}>
                  <div className={styles.reqTitle}>缺少</div>
                  <div className={styles.reqValue} style={{ color: 'var(--blocked)' }}>{requirementSummary.missing}</div>
                </div>
                <div className={`${styles.reqBox} ${styles.external}`}>
                  <div className={styles.reqTitle}>外部依赖</div>
                  <div className={styles.reqValue} style={{ color: 'var(--primary)' }}>{requirementSummary.external}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                <span>字段 (按优先级)</span>
                <span>来源就绪度</span>
              </div>
              <div className={styles.reqList}>
                {checklistItems.map((item) => (
                  <div className={styles.reqListItem} key={item.id}>
                    <span><span className={`${styles.reqDot} ${item.status === 'missing' ? styles.missing : item.status === 'pending' ? styles.external : styles.ready}`}></span>{item.requiredData}</span>
                    {renderChecklistStatus(item.status, styles)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className={styles.sectionHeader} style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>不确定项 ({uncertainItems.length})</div>
              <a href="/review-approvals" style={{ fontSize: '13px', color: 'var(--primary)' }}>查看全部</a>
            </div>
            <div className={styles.sectionBody}>
              {uncertainItems.length ? uncertainItems.map((item) => (
                <div className={styles.warningBox} key={item.id}>
                  <AlertTriangle size={16} className={styles.warningIcon} />
                  <div className={styles.warningContent}>
                    <div className={styles.warningTitle}>
                      <span>{item.label}</span>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'normal' }}>影响 SKU: {item.failedCount}</span>
                    </div>
                    <div className={styles.warningDesc}>{item.requiredData} 需要人工确认或补齐来源映射</div>
                    <a href="/review-approvals" style={{ fontSize: '12px', color: 'var(--primary)', alignSelf: 'flex-start' }}>查看</a>
                  </div>
                </div>
              )) : <div style={{ color: 'var(--muted)', fontSize: '13px' }}>运行检查后展示需要 Review 的规则项。</div>}
            </div>
          </div>

          <div className="panel">
            <div className={styles.sectionHeader} style={{ padding: '16px 20px', borderBottom: 'none' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>决策流程</div>
              <ChevronDown size={16} color="var(--muted)" />
            </div>
            <div className={styles.sectionBody} style={{ paddingTop: 0 }}>
              <DecisionFlowPreview statusSummary={statusSummary} hasSimulation={Boolean(simulationRun)} />
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  )
}

const defaultRuleSourceText = '商品需同时满足以下条件：近30天销量 ≥ 100；好评率 ≥ 95%；库存 ≥ 500；活动价 ≤ 近30天最低价；同品牌同时间段仅可报名一个主玩法（品牌日互斥）。'

const defaultStructuredRules: CanonicalRuleDto[] = [
  { id: 'R618-001', type: 'threshold', field: 'sales30d', operator: 'gte', value: 100, message: '近30天销量 ≥ 100', severity: 'blocking' },
  { id: 'R618-002', type: 'threshold', field: 'positiveRate', operator: 'gte', value: 95, message: '好评率 ≥ 95%', severity: 'blocking' },
  { id: 'R618-003', type: 'threshold', field: 'stock', operator: 'gte', value: 500, message: '库存 ≥ 500', severity: 'blocking' },
  { id: 'R618-004', type: 'field_compare', field: 'campaignPrice', operator: 'lte', compareField: 'lowestPrice30d', message: '活动价 ≤ 近30天最低价', severity: 'warning' },
  { id: 'R618-005', type: 'boolean_block', field: 'joinedBrandDay', operator: 'eq', value: false, message: '品牌日互斥', severity: 'warning' },
]

type ChecklistStatus = 'ready' | 'missing' | 'pending'

interface ChecklistItem {
  id: string
  label: string
  requiredData: string
  source: string
  method: string
  status: ChecklistStatus
  owner: string
  actionHref: string
  actionLabel: string
  failedCount: number
}

function buildChecklistItems(rules: CanonicalRuleDto[], results: SimulationResultDto[], activityId?: string | null): ChecklistItem[] {
  return rules.map((rule) => {
    const failedCount = results.filter((result) => result.failedRules.some((failedRule) => failedRule.id === rule.id || failedRule.field === rule.field)).length
    const status: ChecklistStatus = failedCount === 0 && results.length > 0 ? 'ready' : rule.type === 'manual_review' || rule.type === 'field_compare' || rule.type === 'boolean_block' ? 'pending' : 'missing'
    return {
      id: rule.field ?? rule.compareField ?? rule.id,
      label: rule.message,
      requiredData: requiredDataLabel(rule),
      source: sourceLabel(rule),
      method: ruleCondition(rule),
      status,
      owner: ownerLabel(status, rule),
      actionHref: status === 'missing' ? '/data-sources' : status === 'pending' ? '/review-approvals' : skuAccessHref(undefined, activityId),
      actionLabel: status === 'missing' ? '补数' : status === 'pending' ? '确认' : '查看',
      failedCount,
    }
  })
}

function summarizeRequirements(items: ChecklistItem[]) {
  return {
    ready: items.filter((item) => item.status === 'ready').length,
    missing: items.filter((item) => item.status === 'missing').length,
    external: items.filter((item) => item.status === 'pending').length,
  }
}

function summarizeChecklistStatus(items: ChecklistItem[]) {
  return {
    ready: items.filter((item) => item.status === 'ready').length,
    missing: items.filter((item) => item.status === 'missing').length,
    pending: items.filter((item) => item.status === 'pending').length,
    blocked: items.filter((item) => item.status === 'missing' && item.failedCount > 0).length,
  }
}

function formatRuleSourceTitle(name: string, platform: string): string {
  const normalizedName = name.trim() || '活动规则'
  const normalizedPlatform = platform.trim()
  return normalizedPlatform ? `${normalizedName}（${normalizedPlatform}）` : normalizedName
}

function DecisionFlowPreview({ statusSummary, hasSimulation }: { statusSummary: ReturnType<typeof summarizeChecklistStatus>; hasSimulation: boolean }) {
  const resultLabel = !hasSimulation
    ? '等待运行检查'
    : statusSummary.blocked > 0
      ? `阻塞 ${statusSummary.blocked} 项`
      : statusSummary.pending > 0
        ? `进入 Review ${statusSummary.pending} 项`
        : '生成通过结论'
  const resultColor = !hasSimulation ? 'var(--muted)' : statusSummary.blocked > 0 ? 'var(--blocked)' : statusSummary.pending > 0 ? '#d4a017' : 'var(--ready)'

  return (
    <div className={styles.flowchartPreview}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
        <FlowNode label="规则解析" tone={hasSimulation ? 'ready' : 'muted'} />
        <FlowArrow />
        <FlowNode label={`检查 ${statusSummary.ready + statusSummary.missing + statusSummary.pending} 项`} tone={hasSimulation ? 'ready' : 'muted'} />
        <FlowArrow />
        <FlowNode label={`缺数 ${statusSummary.missing}`} tone={statusSummary.missing ? 'blocked' : 'ready'} />
        <FlowArrow />
        <FlowNode label={`待确认 ${statusSummary.pending}`} tone={statusSummary.pending ? 'pending' : 'ready'} />
        <FlowArrow />
        <FlowNode label={resultLabel} color={resultColor} />
      </div>
    </div>
  )
}

function getInitialRuleExecutionParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

function runConsoleHref(runId: string): string {
  const params = new URLSearchParams({ runId })
  return `/run-console?${params.toString()}`
}

function ruleLibraryHref(ruleSetId: string): string {
  const params = new URLSearchParams({ ruleSetId })
  return `/rule-library?${params.toString()}`
}

function reviewApprovalHref(reviewItemId: string): string {
  const params = new URLSearchParams({ reviewItemId })
  return `/review-approvals?${params.toString()}`
}

function syncRuleExecutionUrl(ruleSetId?: string, simulationRunId?: string, activityId?: string) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (activityId) params.set('activityId', activityId)
  if (ruleSetId) params.set('ruleSetId', ruleSetId)
  if (simulationRunId) params.set('simulationRunId', simulationRunId)
  const nextUrl = `${window.location.pathname}?${params.toString()}`
  if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

function activityPlanToRuleSet(plan: ActivityExecutionPlanDto): ActivityRuleSetDto {
  return {
    ruleSetId: plan.ruleSet.ruleSetId,
    name: `活动执行计划 ${plan.activityId}`,
    sourceText: plan.ruleSet.rules.map((rule) => rule.message).join('\n'),
    rules: plan.ruleSet.rules,
    parseStatus: plan.ruleSet.parseStatus,
    confidence: plan.ruleSet.confidence,
    errors: [],
  }
}

function ruleEvidenceHref(rule: CanonicalRuleDto, results: SimulationResultDto[], activityId?: string | null): string {
  const matchedResult = results.find((result) => result.failedRules.some((failedRule) => failedRule.id === rule.id || failedRule.field === rule.field))
    ?? results[0]
  return skuAccessHref(matchedResult?.skuProfileId, activityId, 'evidence')
}

function skuAccessHref(skuProfileId?: string, activityId?: string | null, drawerTab?: string): string {
  const params = new URLSearchParams()
  if (skuProfileId) params.set('skuProfileId', skuProfileId)
  if (activityId) params.set('activityId', activityId)
  if (drawerTab) params.set('drawerTab', drawerTab)
  const query = params.toString()
  return query ? `/sku-access?${query}` : '/sku-access'
}

function ruleSetDetailToActivityRuleSet(detail: RuleSetDetailDto): ActivityRuleSetDto {
  return {
    ruleSetId: detail.ruleSetId,
    name: detail.name,
    sourceText: detail.sourceText,
    rules: detail.dslJson,
    parseStatus: 'PARSED',
    confidence: 1,
    errors: [],
  }
}

function FlowNode({ label, tone, color }: { label: string; tone?: 'ready' | 'pending' | 'blocked' | 'muted'; color?: string }) {
  const borderColor = color ?? (tone === 'ready' ? 'var(--ready)' : tone === 'pending' ? '#d4a017' : tone === 'blocked' ? 'var(--blocked)' : 'var(--line)')
  return <div style={{ border: `1px solid ${borderColor}`, color: color ?? borderColor, padding: '4px 8px', borderRadius: '4px', background: 'white', fontWeight: tone && tone !== 'muted' ? 600 : 400 }}>{label}</div>
}

function FlowArrow() {
  return <span style={{ color: 'var(--muted)' }}>→</span>
}

function requiredDataLabel(rule: CanonicalRuleDto): string {
  if (rule.compareField) return `${fieldLabel(rule.field)}、${fieldLabel(rule.compareField)}`
  return fieldLabel(rule.field ?? rule.id)
}

function sourceLabel(rule: CanonicalRuleDto): string {
  if (rule.field === 'stock') return '库存中心'
  if (rule.field === 'campaignPrice' || rule.compareField === 'lowestPrice30d') return '价格中心'
  if (rule.type === 'boolean_block') return '活动中心-报名记录'
  return 'SKU 当前投影'
}

function ownerLabel(status: ChecklistStatus, rule: CanonicalRuleDto): string {
  if (status === 'missing') return sourceLabel(rule)
  if (rule.type === 'manual_review' || rule.type === 'field_compare' || rule.type === 'boolean_block') return 'Review Gate'
  return '系统规则引擎'
}

function fieldLabel(field?: string): string {
  if (field === 'sales30d') return '近30天实付销量'
  if (field === 'positiveRate') return '近30天好评率'
  if (field === 'stock') return '可售库存'
  if (field === 'campaignPrice') return '活动价'
  if (field === 'lowestPrice30d') return '近30天最低价'
  if (field === 'joinedBrandDay') return '同品牌活动报名记录'
  return field ?? '规则字段'
}

function ruleCondition(rule: CanonicalRuleDto): string {
  if (rule.compareField) return `${operatorLabel(rule.operator)} ${rule.compareField}`
  if (rule.value !== undefined) return `${operatorLabel(rule.operator)} ${String(rule.value)}`
  return rule.message
}

function operatorLabel(operator: CanonicalRuleDto['operator']): string {
  if (operator === 'gte') return '≥'
  if (operator === 'lte') return '≤'
  if (operator === 'eq') return '='
  if (operator === 'neq') return '≠'
  return '-'
}

function ruleTypeLabel(type: CanonicalRuleDto['type'], severity: CanonicalRuleDto['severity']): string {
  if (type === 'manual_review') return '人工确认'
  if (type === 'boolean_block') return '互斥条件'
  if (type === 'field_compare') return severity === 'blocking' ? '硬条件' : '需确认'
  if (type === 'data_required') return '数据必填'
  if (type === 'quota') return '名额规则'
  return severity === 'blocking' ? '硬条件' : '提示条件'
}

function confidenceLabel(confidence: number): string {
  return `${confidence >= 0.9 ? '高' : '中'} ${confidence.toFixed(2)}`
}

function renderChecklistStatus(status: ChecklistStatus, styleMap: typeof styles) {
  if (status === 'ready') return <span className={styleMap.tagReady}>✓ 已完成</span>
  if (status === 'missing') return <span className={styleMap.tagMissing}>✗ 缺少数据</span>
  return <span className={styleMap.tagExternal} style={{ color: '#d4a017', background: 'rgba(212,160,23,0.1)' }}>/ 待确认</span>
}
