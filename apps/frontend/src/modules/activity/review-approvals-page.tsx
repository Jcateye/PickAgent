'use client'

import React, { useState } from 'react'
import { ChevronRight, Search, SlidersHorizontal, Package, FileCheck, HelpCircle, AlertOctagon, X, CheckCircle2, XCircle, Edit, ShieldAlert } from 'lucide-react'
import styles from './review-approvals.module.css'

export function ReviewApprovalsPage() {
  const [selectedItem, setSelectedItem] = useState<string | null>('123456')

  return (
    <div className={styles.layout}>
      <div className={styles.mainContent}>
        
        <div className={styles.pageHeader}>
          Review工作台 <ChevronRight size={14} /> 待审批建议
        </div>

        <h1 className={styles.pageTitle}>Review 工作台</h1>

        <div className={styles.tabs}>
          <div className={`${styles.tab} ${styles.active}`}>待审批建议 <span className={styles.tabBadge}>12</span></div>
          <div className={styles.tab}>已批准</div>
          <div className={styles.tab}>已驳回</div>
          <div className={styles.tab}>已修改</div>
          <div className={styles.tab}>草稿</div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <div className={styles.filterSelect}>全部类型 <ChevronRight size={12} style={{transform: 'rotate(90deg)'}}/></div>
            <div className={styles.filterSelect}>全部风险等级 <ChevronRight size={12} style={{transform: 'rotate(90deg)'}}/></div>
            <div className={styles.filterSelect}>全部状态 <ChevronRight size={12} style={{transform: 'rotate(90deg)'}}/></div>
            <div className={styles.filterSelect} style={{ color: 'var(--muted)' }}>
              到期时间： 开始日期 ~ 结束日期
            </div>
          </div>
          <div className={styles.filterGroup}>
            <div className={styles.searchInput}>
              <Search size={14} color="var(--muted)" />
              <input type="text" placeholder="搜索建议、SKU、任务ID、负责人" />
            </div>
            <button className="secondaryButton" style={{ padding: '6px 12px' }}><SlidersHorizontal size={14} /> 筛选</button>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <div className={styles.tableHeader}>
            <div></div>
            <div>优先级</div>
            <div>类型</div>
            <div>建议摘要</div>
            <div>状态</div>
            <div>风险等级</div>
            <div>负责人</div>
            <div>到期时间</div>
            <div>证据摘要</div>
          </div>

          {/* Row 1 */}
          <div className={`${styles.tableRow} ${selectedItem === '123456' ? styles.selected : ''}`} onClick={() => setSelectedItem('123456')}>
            <div>
              <input type="radio" checked={selectedItem === '123456'} readOnly />
            </div>
            <div><span className={`${styles.priorityBadge} ${styles.p1}`}>P1</span></div>
            <div className={styles.rowType}><Package size={14} color="#d97706" /> 补货建议</div>
            <div>
              <div className={styles.rowTitle}>补货建议: SKU-123456</div>
              <div className={styles.rowDesc}>补货至建议库存 1,200 (目前 320)</div>
            </div>
            <div><span className={styles.statusBadge}>待审批</span></div>
            <div className={styles.riskLevel}><span className={`${styles.riskDot} ${styles.high}`}></span> 高</div>
            <div className={styles.ownerBlock}>
              <div className={styles.ownerAvatar}>OP</div>
              <div>
                <div style={{fontSize:'12px', fontWeight:500}}>运营专员</div>
                <div style={{fontSize:'11px', color:'var(--muted)'}}>op_team</div>
              </div>
            </div>
            <div style={{color: '#dc2626'}}>今天 18:00</div>
            <div>
              <div style={{fontSize:'12px'}}>销量预测 ↑ 42%</div>
              <div style={{fontSize:'12px', color:'var(--muted)'}}>30天销量: 860</div>
            </div>
          </div>

          {/* Row 2 */}
          <div className={styles.tableRow}>
            <div><input type="radio" readOnly /></div>
            <div><span className={`${styles.priorityBadge} ${styles.p2}`}>P2</span></div>
            <div className={styles.rowType}><FileCheck size={14} color="#2563eb" /> 证书补全</div>
            <div>
              <div className={styles.rowTitle}>证书补全: SKU-789012</div>
              <div className={styles.rowDesc}>建议上传 ISO 13485 证书</div>
            </div>
            <div><span className={styles.statusBadge}>待审批</span></div>
            <div className={styles.riskLevel}><span className={`${styles.riskDot} ${styles.medium}`}></span> 中</div>
            <div className={styles.ownerBlock}>
              <div className={styles.ownerAvatar} style={{background:'#16a34a'}}>QA</div>
              <div>
                <div style={{fontSize:'12px', fontWeight:500}}>质量专员</div>
                <div style={{fontSize:'11px', color:'var(--muted)'}}>qa_team</div>
              </div>
            </div>
            <div>明天 12:00</div>
            <div>
              <div style={{fontSize:'12px'}}>类目要求: 医疗器械</div>
              <div style={{fontSize:'12px', color:'var(--muted)'}}>缺失证书: ISO 13485</div>
            </div>
          </div>

          {/* Row 3 */}
          <div className={styles.tableRow}>
            <div><input type="radio" readOnly /></div>
            <div><span className={`${styles.priorityBadge} ${styles.p2}`}>P2</span></div>
            <div className={styles.rowType}><HelpCircle size={14} color="#64748b" /> 规则口径确认</div>
            <div>
              <div className={styles.rowTitle}>规则口径确认: 带电产品标识</div>
              <div className={styles.rowDesc}>需确认“带电产品”口径范围</div>
            </div>
            <div><span className={styles.statusBadge}>待审批</span></div>
            <div className={styles.riskLevel}><span className={`${styles.riskDot} ${styles.medium}`}></span> 中</div>
            <div className={styles.ownerBlock}>
              <div className={styles.ownerAvatar} style={{background:'#6366f1'}}>PC</div>
              <div>
                <div style={{fontSize:'12px', fontWeight:500}}>合规专员</div>
                <div style={{fontSize:'11px', color:'var(--muted)'}}>compliance_team</div>
              </div>
            </div>
            <div>明天 17:00</div>
            <div>
              <div style={{fontSize:'12px'}}>影响范围: 1,248 SKU</div>
              <div style={{fontSize:'12px', color:'var(--muted)'}}>涉及类目: 3</div>
            </div>
          </div>
          
          {/* Row 4 */}
          <div className={styles.tableRow}>
            <div><input type="radio" readOnly /></div>
            <div><span className={`${styles.priorityBadge} ${styles.p3}`}>P3</span></div>
            <div className={styles.rowType}><AlertOctagon size={14} color="#e11d48" /> 活动互斥排除</div>
            <div>
              <div className={styles.rowTitle}>活动互斥排除: SKU-345678</div>
              <div className={styles.rowDesc}>建议从“夏季大促”排除</div>
            </div>
            <div><span className={styles.statusBadge}>待审批</span></div>
            <div className={styles.riskLevel}><span className={`${styles.riskDot} ${styles.medium}`}></span> 中</div>
            <div className={styles.ownerBlock}>
              <div className={styles.ownerAvatar} style={{background:'#0ea5e9'}}>MK</div>
              <div>
                <div style={{fontSize:'12px', fontWeight:500}}>市场专员</div>
                <div style={{fontSize:'11px', color:'var(--muted)'}}>marketing_team</div>
              </div>
            </div>
            <div>后天 10:00</div>
            <div>
              <div style={{fontSize:'12px'}}>冲突活动: 满减券A</div>
              <div style={{fontSize:'12px', color:'var(--muted)'}}>预计冲突率: 24%</div>
            </div>
          </div>
        </div>

        <div className={styles.tableFooter}>
          <div>共 12 条</div>
          <div className={styles.pagination}>
            <div className={styles.pageBtn}><ChevronRight size={14} style={{transform:'rotate(180deg)'}} /></div>
            <div className={`${styles.pageBtn} ${styles.active}`}>1</div>
            <div className={styles.pageBtn}>2</div>
            <div className={styles.pageBtn}><ChevronRight size={14} /></div>
            <div style={{marginLeft:'8px', display:'flex', alignItems:'center', gap:'4px'}}>
              20 条/页 <ChevronRight size={12} style={{transform: 'rotate(90deg)'}}/>
            </div>
          </div>
        </div>
      </div>

      {selectedItem === '123456' && (
        <div className={styles.drawer}>
          <div className={styles.drawerHeader}>
            <div>
              <div className={styles.drawerTitle}>
                <Package size={18} color="#d97706" /> 
                补货建议: SKU-123456
                <span className={styles.drawerRisk}>高风险</span>
              </div>
              <div style={{fontSize:'12px', color:'var(--muted)', marginTop:'8px'}}>
                任务ID: TASK-2025-05-23-0001
              </div>
            </div>
            <div style={{cursor:'pointer'}} onClick={() => setSelectedItem(null)}><X size={18} color="var(--muted)" /></div>
          </div>

          <div className={styles.drawerBody}>
            <div className={styles.drawerTabs}>
              <div className={`${styles.tab} ${styles.active}`}>建议</div>
              <div className={styles.tab}>风险</div>
              <div className={styles.tab}>证据</div>
              <div className={styles.tab}>相关规则</div>
              <div className={styles.tab}>审批记录</div>
            </div>

            <div style={{fontWeight:600, marginBottom:'12px'}}>建议内容</div>
            <div className={styles.suggestionBox}>
              建议将 SKU-123456 的可售库存提升至 1,200 件。<br/>
              当前可售库存 320 件，低于安全库存阈值。
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>当前库存</span>
                <span className={styles.metricValue}>320</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>建议库存</span>
                <span className={styles.metricValue}>1,200</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>建议补货量</span>
                <span className={styles.metricValue} style={{color: '#16a34a'}}>880</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricLabel}>建议到货日期</span>
                <span className={styles.metricValue}>2025-05-27</span>
              </div>
            </div>

            <div style={{fontWeight:600, marginBottom:'12px'}}>理由与依据</div>
            <ul className={styles.reasonsList}>
              <li>未来 7 天销量预测: 预计 420 件 (较当前库存高 31%)</li>
              <li>安全库存阈值: 1,000 件</li>
              <li>在途库存: 200 件 (预计 5/25 到货)</li>
              <li>历史销量趋势: 近 30 天销量 860 件, 环比 ↑ 42%</li>
            </ul>

            <div className={styles.approvalWarning}>
              <ShieldAlert size={20} color="#d97706" style={{flexShrink:0}} />
              <div>
                <div style={{fontWeight:600, color:'#92400e', marginBottom:'4px'}}>需要人工审批</div>
                <div className={styles.approvalWarningText}>
                  该操作涉及库存采购补货执行，存在资金占用与滞销风险，必须经人工审批后执行。
                </div>
              </div>
            </div>

            <div className={styles.actionArea}>
              <button className={`${styles.actionBtn} ${styles.btnApprove}`}><CheckCircle2 size={16} /> 批准</button>
              <button className={`${styles.actionBtn} ${styles.btnReject}`}><XCircle size={16} /> 驳回</button>
              <button className={`${styles.actionBtn} ${styles.btnModify}`}><Edit size={16} /> 修改后批准</button>
            </div>

            <div style={{fontSize:'13px', color:'var(--muted)', marginBottom:'8px'}}>备注 (选填)</div>
            <textarea className={styles.remarkInput} placeholder="请输入审批备注，便于后续追溯..."></textarea>
          </div>
        </div>
      )}

    </div>
  )
}
