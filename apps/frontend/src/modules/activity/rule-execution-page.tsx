'use client'

import React, { useState } from 'react'
import { Play, FileText, AlertTriangle, ChevronDown, MoreHorizontal, CheckSquare, RefreshCw } from 'lucide-react'
import type { ActivityRuleSetDto } from '../../../../contracts/types/businessFoundation'
import { fetchActivityApi } from './api-client'
import styles from './rule-execution.module.css'

export function RuleExecutionPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
      setMessage(`运行检查已完成：${ruleSet.ruleSetId}，解析 ${ruleSet.rules.length} 条规则，置信度 ${ruleSet.confidence}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '运行检查失败')
    } finally {
      setBusy(false)
    }
  }

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
                <tr>
                  <td>R618-001</td>
                  <td>近30天销量</td>
                  <td>≥ 100</td>
                  <td>硬条件</td>
                  <td className={styles.highConfidence}>高 0.98</td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                </tr>
                <tr>
                  <td>R618-002</td>
                  <td>好评率</td>
                  <td>≥ 95%</td>
                  <td>硬条件</td>
                  <td className={styles.highConfidence}>高 0.97</td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                </tr>
                <tr>
                  <td>R618-003</td>
                  <td>库存</td>
                  <td>≥ 500</td>
                  <td>硬条件</td>
                  <td className={styles.highConfidence}>高 0.96</td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                </tr>
                <tr>
                  <td>R618-004</td>
                  <td>活动价</td>
                  <td>≤ 近30天最低价</td>
                  <td>硬条件</td>
                  <td className={styles.medConfidence}>中 0.82</td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                </tr>
                <tr>
                  <td>R618-005</td>
                  <td>品牌日互斥</td>
                  <td>同品牌同时间段仅1个主玩法</td>
                  <td>互斥条件</td>
                  <td className={styles.medConfidence}>中 0.78</td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看证据 ↗</a></td>
                </tr>
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--muted)' }}>
              <span>共 5 条</span>
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
                <button className="secondaryButton" type="button" onClick={() => setMessage('批量指派需要接入团队/用户目录；当前已记录为 Review 后续动作。')} style={{ height: '32px', fontSize: '13px' }}>批量指派</button>
                <button className="secondaryButton" type="button" onClick={() => setMessage('批量标记会在接入 checklist persistence 后落库。')} style={{ height: '32px', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <CheckSquare size={14} style={{ marginRight: '6px' }} /> 批量标记 ∨
                </button>
                <button className="iconButton" type="button" onClick={() => void runCheck()} style={{ height: '32px', width: '32px' }}><RefreshCw size={14} /></button>
              </div>
            </div>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}><input type="checkbox" /></th>
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
                <tr>
                  <td><input type="checkbox" /></td>
                  <td><FileText size={14} style={{ marginRight: '6px', color: 'var(--primary)', verticalAlign: 'middle' }}/> 近30天销量 ≥ 100</td>
                  <td>近30天实付销量</td>
                  <td>生意参谋-商品分析</td>
                  <td>数值比较 (≥100)</td>
                  <td><span className={styles.tagReady}>✓ 已完成</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width:'20px', height:'20px', background:'#eee', borderRadius:'50%'}}></div>运营同学</div></td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看</a></td>
                </tr>
                <tr>
                  <td><input type="checkbox" /></td>
                  <td><FileText size={14} style={{ marginRight: '6px', color: 'var(--primary)', verticalAlign: 'middle' }}/> 好评率 ≥ 95%</td>
                  <td>近30天好评率</td>
                  <td>生意参谋-商品评价</td>
                  <td>数值比较 (≥95%)</td>
                  <td><span className={styles.tagReady}>✓ 已完成</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width:'20px', height:'20px', background:'#eee', borderRadius:'50%'}}></div>运营同学</div></td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看</a></td>
                </tr>
                <tr>
                  <td><input type="checkbox" /></td>
                  <td><FileText size={14} style={{ marginRight: '6px', color: 'var(--primary)', verticalAlign: 'middle' }}/> 库存 ≥ 500</td>
                  <td>可售库存</td>
                  <td>天猫库存中心</td>
                  <td>数值比较 (≥500)</td>
                  <td><span className={styles.tagMissing}>✗ 缺少数据</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width:'20px', height:'20px', background:'#eee', borderRadius:'50%'}}></div>数据同学</div></td>
                  <td><a href="/data-sources" style={{ color: 'var(--primary)' }}>补数</a></td>
                </tr>
                <tr>
                  <td><input type="checkbox" /></td>
                  <td><FileText size={14} style={{ marginRight: '6px', color: 'var(--primary)', verticalAlign: 'middle' }}/> 活动价 ≤ 近30天最低价</td>
                  <td>近30天最低价、活动价</td>
                  <td>价格中心</td>
                  <td>数值比较 (≤最低价)</td>
                  <td><span className={styles.tagExternal} style={{ color: '#d4a017', background: 'rgba(212,160,23,0.1)' }}>/ 待确认</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width:'20px', height:'20px', background:'#eee', borderRadius:'50%'}}></div>运营同学</div></td>
                  <td><a href="/review-approvals" style={{ color: 'var(--primary)' }}>确认</a></td>
                </tr>
                <tr>
                  <td><input type="checkbox" /></td>
                  <td><FileText size={14} style={{ marginRight: '6px', color: 'var(--primary)', verticalAlign: 'middle' }}/> 品牌日互斥</td>
                  <td>同品牌活动报名记录</td>
                  <td>活动中心-报名记录</td>
                  <td>互斥校验 (唯一性)</td>
                  <td><span className={styles.tagExternal} style={{ color: '#d4a017', background: 'rgba(212,160,23,0.1)' }}>/ 待确认</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width:'20px', height:'20px', background:'#eee', borderRadius:'50%'}}></div>运营同学</div></td>
                  <td><a href="/sku-access" style={{ color: 'var(--primary)' }}>查看</a></td>
                </tr>
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
