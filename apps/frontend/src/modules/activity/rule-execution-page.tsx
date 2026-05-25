'use client'

import React, { useState } from 'react'
import { Play, FileText, AlertTriangle, ChevronDown, MoreHorizontal, CheckSquare, RefreshCw } from 'lucide-react'
import type { ActivityRuleSetDto, CanonicalRuleDto, ReviewItemDto } from '../../../../contracts/types/businessFoundation'
import { fetchActivityApi } from './api-client'
import styles from './rule-execution.module.css'

export function RuleExecutionPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ruleSet, setRuleSet] = useState<ActivityRuleSetDto | null>(null)
  const [selectedChecks, setSelectedChecks] = useState<string[]>(['stock', 'price', 'brand_conflict'])

  async function runCheck() {
    setBusy(true)
    try {
      const ruleSet = await fetchActivityApi<ActivityRuleSetDto>('/api/activities/parse', {
        method: 'POST',
        body: JSON.stringify({
          name: '天猫618规则执行路径',
          platform: 'tmall',
          sourceText: '商品需同时满足以下条件：近30天销量 ≥ 100；好评率 ≥ 95%；库存 ≥ 500；活动价 ≤ 近30天最低价；同品牌同时间段仅可报名一个主玩法（品牌日互斥）。',
        }),
      })
      setRuleSet(ruleSet)
      setMessage(`运行检查已完成：${ruleSet.ruleSetId}，解析 ${ruleSet.rules.length} 条规则，置信度 ${ruleSet.confidence}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '运行检查失败')
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

  return (
    <div className="pageStack">
      <div className="pageHeader" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px' }}>天猫618规则执行路径</h1>
            <span className="statusBadge statusBadge--ready" style={{ fontSize: '12px' }}>✓ 已解析</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', color: 'var(--muted)', fontSize: '13px', marginTop: '12px' }}>
            <span>规则版本: v3.2.1</span>
            <span>创建人: 运营同学</span>
            <span>创建时间: 2025-05-09 10:32</span>
            <span>适用范围: 全量 SKU (1,258)</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="primaryButton" type="button" onClick={() => void runCheck()} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Play size={16} /> 运行检查
          </button>
          <a className="secondaryButton" href="/run-console" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} /> 查看 Run
          </a>
          <button className="iconButton" type="button" onClick={() => setMessage('更多操作已收敛到规则库、Run 控制台和 SKU 准入工作台。')}>
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
              <p className={styles.originalRuleText}>
                商品需同时满足以下条件：近30天销量 ≥ 100；好评率 ≥ 95%；库存 ≥ 500；活动价 ≤ 近30天最低价；同品牌同时间段仅可报名一个主玩法（品牌日互斥）。
              </p>
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
              <div style={{ fontSize: '15px', fontWeight: 600 }}>数据需求 (共 8 项)</div>
              <a href="/data-sources" style={{ fontSize: '13px', color: 'var(--primary)' }}>查看全部</a>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.dataRequirementGrid}>
                <div className={`${styles.reqBox} ${styles.ready}`}>
                  <div className={styles.reqTitle}>已就绪</div>
                  <div className={styles.reqValue} style={{ color: 'var(--ready)' }}>4</div>
                </div>
                <div className={`${styles.reqBox} ${styles.missing}`}>
                  <div className={styles.reqTitle}>缺少</div>
                  <div className={styles.reqValue} style={{ color: 'var(--blocked)' }}>2</div>
                </div>
                <div className={`${styles.reqBox} ${styles.external}`}>
                  <div className={styles.reqTitle}>外部依赖</div>
                  <div className={styles.reqValue} style={{ color: 'var(--primary)' }}>2</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                <span>字段 (按优先级)</span>
                <span>来源就绪度</span>
              </div>
              <div className={styles.reqList}>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.ready}`}></span>近30天实付销量</span>
                  <span className={styles.tagReady}>已就绪</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.ready}`}></span>近30天好评率</span>
                  <span className={styles.tagReady}>已就绪</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.missing}`}></span>可售库存</span>
                  <span className={styles.tagMissing}>缺少数据</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.ready}`}></span>近30天最低价</span>
                  <span className={styles.tagReady}>已就绪</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.ready}`}></span>活动价</span>
                  <span className={styles.tagReady}>已就绪</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.external}`}></span>同品牌活动报名记录</span>
                  <span className={styles.tagExternal}>外部依赖</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.external}`}></span>商品SPU品牌</span>
                  <span className={styles.tagExternal}>外部依赖</span>
                </div>
                <div className={styles.reqListItem}>
                  <span><span className={`${styles.reqDot} ${styles.ready}`}></span>活动时间范围</span>
                  <span className={styles.tagReady}>已就绪</span>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className={styles.sectionHeader} style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>不确定项 (2)</div>
              <a href="/review-approvals" style={{ fontSize: '13px', color: 'var(--primary)' }}>查看全部</a>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.warningBox}>
                <AlertTriangle size={16} className={styles.warningIcon} />
                <div className={styles.warningContent}>
                  <div className={styles.warningTitle}>
                    <span>活动价 ≤ 近30天最低价</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'normal' }}>置信度: 0.82</span>
                  </div>
                  <div className={styles.warningDesc}>最低价统计口径存在多版本差异</div>
                  <a href="/review-approvals" style={{ fontSize: '12px', color: 'var(--primary)', alignSelf: 'flex-start' }}>查看</a>
                </div>
              </div>
              <div className={styles.warningBox}>
                <AlertTriangle size={16} className={styles.warningIcon} />
                <div className={styles.warningContent}>
                  <div className={styles.warningTitle}>
                    <span>品牌日互斥</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 'normal' }}>置信度: 0.78</span>
                  </div>
                  <div className={styles.warningDesc}>品牌日口径存在歧义 (是自然日还是活动日)</div>
                  <a href="/review-approvals" style={{ fontSize: '12px', color: 'var(--primary)', alignSelf: 'flex-start' }}>查看</a>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className={styles.sectionHeader} style={{ padding: '16px 20px', borderBottom: 'none' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>决策流程 (预览)</div>
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

const defaultStructuredRules: CanonicalRuleDto[] = [
  { id: 'R618-001', type: 'threshold', field: 'sales30d', operator: 'gte', value: 100, message: '近30天销量 ≥ 100', severity: 'blocking' },
  { id: 'R618-002', type: 'threshold', field: 'positiveRate', operator: 'gte', value: 95, message: '好评率 ≥ 95%', severity: 'blocking' },
  { id: 'R618-003', type: 'threshold', field: 'stock', operator: 'gte', value: 500, message: '库存 ≥ 500', severity: 'blocking' },
  { id: 'R618-004', type: 'field_compare', field: 'campaignPrice', operator: 'lte', compareField: 'lowestPrice30d', message: '活动价 ≤ 近30天最低价', severity: 'warning' },
  { id: 'R618-005', type: 'boolean_block', field: 'joinedBrandDay', operator: 'eq', value: false, message: '品牌日互斥', severity: 'warning' },
]

const checklistItems = [
  { id: 'sales30d', label: '近30天销量 ≥ 100', requiredData: '近30天实付销量', source: '生意参谋-商品分析', method: '数值比较 (≥100)', status: 'ready', owner: '运营同学', actionHref: '/sku-access', actionLabel: '查看' },
  { id: 'positive_rate', label: '好评率 ≥ 95%', requiredData: '近30天好评率', source: '生意参谋-商品评价', method: '数值比较 (≥95%)', status: 'ready', owner: '运营同学', actionHref: '/sku-access', actionLabel: '查看' },
  { id: 'stock', label: '库存 ≥ 500', requiredData: '可售库存', source: '天猫库存中心', method: '数值比较 (≥500)', status: 'missing', owner: '数据同学', actionHref: '/data-sources', actionLabel: '补数' },
  { id: 'price', label: '活动价 ≤ 近30天最低价', requiredData: '近30天最低价、活动价', source: '价格中心', method: '数值比较 (≤最低价)', status: 'pending', owner: '运营同学', actionHref: '/review-approvals', actionLabel: '确认' },
  { id: 'brand_conflict', label: '品牌日互斥', requiredData: '同品牌活动报名记录', source: '活动中心-报名记录', method: '互斥校验 (唯一性)', status: 'pending', owner: '运营同学', actionHref: '/sku-access', actionLabel: '查看' },
] as const

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

function renderChecklistStatus(status: typeof checklistItems[number]['status'], styleMap: typeof styles) {
  if (status === 'ready') return <span className={styleMap.tagReady}>✓ 已完成</span>
  if (status === 'missing') return <span className={styleMap.tagMissing}>✗ 缺少数据</span>
  return <span className={styleMap.tagExternal} style={{ color: '#d4a017', background: 'rgba(212,160,23,0.1)' }}>/ 待确认</span>
}
