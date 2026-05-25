'use client'

import React, { useState } from 'react'
import { Play, FileText, AlertTriangle, ChevronDown, MoreHorizontal, CheckSquare, RefreshCw } from 'lucide-react'
import type { ActivityRuleSetDto, CanonicalRuleDto, ReviewItemDto, RuleSetDetailDto, SimulationResultDto } from '../../../../contracts/types/businessFoundation'
import type { DashboardSkuListItemDto } from '../../../../contracts/types/dashboardSkuReadModels'
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
}

interface DashboardSkuPageDto {
  items: DashboardSkuListItemDto[]
  total: number
}

export function RuleExecutionPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ruleName, setRuleName] = useState('活动规则执行路径')
  const [platform, setPlatform] = useState('tmall')
  const [sourceText, setSourceText] = useState(defaultRuleSourceText)
  const [ruleSet, setRuleSet] = useState<ActivityRuleSetDto | null>(null)
  const [simulationRun, setSimulationRun] = useState<ActivitySimulationRunDto | null>(null)
  const [selectedChecks, setSelectedChecks] = useState<string[]>(['stock', 'price', 'brand_conflict'])

  async function runCheck() {
    setBusy(true)
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
      setMessage(`运行检查已完成：${run.simulationRunId}，模拟 ${run.results.length} 个 SKU，阻断 ${run.results.filter((item) => item.eligibility === 'BLOCKED').length} 个。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '运行检查失败')
    } finally {
      setBusy(false)
    }
  }

  async function saveRuleSetToLibrary() {
    setBusy(true)
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
      setMessage(`${action === 'assign' ? '批量指派' : '批量标记复核'}已生成 Review：${created.map((item) => item.reviewItemId).join(', ')}`)
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
  const checklistItems = buildChecklistItems(structuredRules, simulationRun?.results ?? [])
  const requirementSummary = summarizeRequirements(checklistItems)
  const uncertainItems = checklistItems.filter((item) => item.status === 'pending')

  return (
    <div className="pageStack">
      <div className="pageHeader" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px' }}>{ruleSet?.name ?? ruleName}</h1>
            <span className="statusBadge statusBadge--ready" style={{ fontSize: '12px' }}>{ruleSet ? '✓ 已解析' : '待运行'}</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
            <span>规则版本: {ruleSet?.ruleSetId ? ruleSet.ruleSetId.slice(0, 8) : '待运行'}</span>
            <span>创建人: 运营同学</span>
            <span>创建时间: {simulationRun ? new Date(simulationRun.startedAt).toLocaleString('zh-CN') : '待运行'}</span>
            <span>适用范围: {simulationRun ? `已模拟 SKU (${simulationRun.results.length})` : '运行后读取真实 SKU'}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="primaryButton" type="button" onClick={() => void runCheck()} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Play size={16} /> 运行检查
          </button>
          <a className="secondaryButton" href="/run-console" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} /> 查看 Run
          </a>
          <button className="iconButton" type="button" onClick={() => void saveRuleSetToLibrary()} disabled={busy} title="保存到规则库">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
      {message ? <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{message}</div> : null}

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
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>天猫618活动报名规则（部分类）</div>
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
                {structuredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.id}</td>
                    <td>{rule.field ?? rule.compareField ?? '-'}</td>
                    <td>{ruleCondition(rule)}</td>
                    <td>{ruleTypeLabel(rule.type, rule.severity)}</td>
                    <td className={(ruleSet?.confidence ?? 0.9) >= 0.9 ? styles.highConfidence : styles.medConfidence}>{confidenceLabel(ruleSet?.confidence ?? 0.9)}</td>
                    <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                  </tr>
                ))}
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
                  <CheckSquare size={14} style={{ marginRight: '6px' }} /> 批量标记 ∨
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
              <span>共 5 条</span>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span style={{ color: 'var(--ready)' }}>● 已完成 2</span>
                <span style={{ color: 'var(--blocked)' }}>● 缺少数据 1</span>
                <span style={{ color: '#d4a017' }}>● 待确认 2</span>
                <span>● 阻塞 0</span>
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
              <div className={styles.flowchartPreview}>
                {/* Simplified flowchart visualization for prototype */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <div style={{ border: '1px solid var(--line)', padding: '4px 8px', borderRadius: '4px', background: 'white' }}>开始</div>
                  <span style={{ color: 'var(--muted)' }}>→</span>
                  <div style={{ border: '1px solid var(--line)', padding: '4px 8px', borderRadius: '4px', background: 'white' }}>检查清单</div>
                  <span style={{ color: 'var(--muted)' }}>→</span>
                  <div style={{ border: '1px solid var(--line)', padding: '4px 8px', borderRadius: '4px', background: 'white', transform: 'rotate(45deg)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ transform: 'rotate(-45deg)' }}>全部通过?</span>
                  </div>
                  <span style={{ color: 'var(--ready)', fontWeight: 600 }}>是 →</span>
                  <div style={{ border: '1px solid var(--line)', padding: '4px 8px', borderRadius: '4px', background: 'white' }}>生成结论</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
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

function buildChecklistItems(rules: CanonicalRuleDto[], results: SimulationResultDto[]): ChecklistItem[] {
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
      owner: status === 'missing' ? '数据同学' : '运营同学',
      actionHref: status === 'missing' ? '/data-sources' : status === 'pending' ? '/review-approvals' : '/sku-access',
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
