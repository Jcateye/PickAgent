'use client'

import React from 'react'
import { FileCheck, Database, Zap, FileText, Check, ChevronRight, ChevronLeft, Download, Filter } from 'lucide-react'
import styles from './activity-execution.module.css'

export function ActivityExecutionPage() {
  return (
    <div className="pageStack">
      <div className="pageHeader">
        <div>
          <div className={styles.titleRow}>
            <h1 style={{ fontSize: '24px' }}>执行天猫618选品规则检查</h1>
            <span className="statusBadge statusBadge--warning" style={{ fontSize: '12px', padding: '2px 8px' }}>运行中</span>
          </div>
          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <span>目标：解析并校验天猫618选品规则，识别不符合项，生成可报名 SKU 清单与待处理项。</span>
            </div>
            <div style={{ flex: 1 }}></div>
            <div className={styles.metaItem}>
              <span>创建人</span>
              <span className={styles.metaValue}>运营同学</span>
            </div>
            <div className={styles.metaItem}>
              <span>创建时间</span>
              <span className={styles.metaValue}>2025-05-09 10:32</span>
            </div>
            <div className={styles.metaItem}>
              <span>执行范围</span>
              <span className={styles.metaValue}>全量 SKU (1,258)</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.nextStepBanner}>
        <strong>下一步：</strong> 完成准入模拟，生成 Review 清单并进入人工确认。
      </div>

      <div className={styles.evidenceSummary}>
        <div className={styles.evidenceCard}>
          <div className={styles.evidenceIcon}><FileCheck size={24} /></div>
          <div className={styles.evidenceInfo}>
            <span className={styles.evidenceTitle}>规则版本</span>
            <span className={styles.evidenceValue}>v3.2.1</span>
            <a href="#" className={styles.evidenceLink}>查看规则</a>
          </div>
        </div>
        <div className={styles.evidenceCard}>
          <div className={styles.evidenceIcon}><Database size={24} /></div>
          <div className={styles.evidenceInfo}>
            <span className={styles.evidenceTitle}>数据源</span>
            <span className={styles.evidenceValue}>8/8 正常</span>
            <a href="#" className={styles.evidenceLink}>查看数据</a>
          </div>
        </div>
        <div className={styles.evidenceCard}>
          <div className={styles.evidenceIcon}><Zap size={24} /></div>
          <div className={styles.evidenceInfo}>
            <span className={styles.evidenceTitle}>插件任务</span>
            <span className={styles.evidenceValue}>12/12 成功</span>
            <a href="#" className={styles.evidenceLink}>查看 Run</a>
          </div>
        </div>
        <div className={styles.evidenceCard}>
          <div className={styles.evidenceIcon}><FileText size={24} /></div>
          <div className={styles.evidenceInfo}>
            <span className={styles.evidenceTitle}>诊断结果</span>
            <span className={styles.evidenceValue}>1,258 个 SKU</span>
            <a href="#" className={styles.evidenceLink}>查看证据</a>
          </div>
        </div>
      </div>

      <div className={styles.stepper}>
        <div className={styles.step}>
          <div className={styles.stepHeader}>
            <div className={`${styles.stepIcon} ${styles.completed}`}><Check size={14} /></div>
            <span className={`${styles.stepTitle} ${styles.completed}`}>1. 规则解析</span>
          </div>
          <div className={styles.stepSub}>已完成<br />05-09 10:33</div>
          <div className={`${styles.stepLine} ${styles.completed}`}></div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepHeader}>
            <div className={`${styles.stepIcon} ${styles.completed}`}><Check size={14} /></div>
            <span className={`${styles.stepTitle} ${styles.completed}`}>2. 数据检查</span>
          </div>
          <div className={styles.stepSub}>已完成<br />05-09 10:36</div>
          <div className={`${styles.stepLine} ${styles.completed}`}></div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepHeader}>
            <div className={`${styles.stepIcon} ${styles.completed}`}><Check size={14} /></div>
            <span className={`${styles.stepTitle} ${styles.completed}`}>3. 插件采集</span>
          </div>
          <div className={styles.stepSub}>已完成<br />05-09 10:41</div>
          <div className={`${styles.stepLine} ${styles.active}`}></div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepHeader}>
            <div className={`${styles.stepIcon} ${styles.active}`}>4</div>
            <span className={`${styles.stepTitle} ${styles.completed}`}>SKU 诊断</span>
          </div>
          <div className={styles.stepSub} style={{color: 'var(--primary)'}}>运行中<br />预计 2 分钟</div>
          <div className={`${styles.stepLine}`}></div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepHeader}>
            <div className={styles.stepIcon}>5</div>
            <span className={`${styles.stepTitle} ${styles.pending}`}>准入模拟</span>
          </div>
          <div className={styles.stepSub}>待开始</div>
          <div className={`${styles.stepLine}`}></div>
        </div>
        <div className={styles.step} style={{flex: 0, minWidth: '100px'}}>
          <div className={styles.stepHeader}>
            <div className={styles.stepIcon}>6</div>
            <span className={`${styles.stepTitle} ${styles.pending}`}>Review 生成</span>
          </div>
          <div className={styles.stepSub}>待开始</div>
        </div>
      </div>

      <div className={styles.dataCards}>
        <div className={styles.dataCard}>
          <div className={styles.dataCardTitle}>规则解析</div>
          <div className={styles.dataCardContent}>
            <div className={styles.ruleVersion}>
              v3.2.1 <span className="statusBadge statusBadge--ready" style={{fontSize: '10px', height: '20px', minHeight: '20px'}}>已更新</span>
            </div>
            <div className={styles.dataStatGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>规则条数</span>
                <span className={styles.statValue}>28 条</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>关键限制项</span>
                <span className={styles.statValue}>12 条</span>
              </div>
            </div>
            <a href="#" className={styles.evidenceLink}>查看规则</a>
          </div>
        </div>
        <div className={styles.dataCard}>
          <div className={styles.dataCardTitle}>数据新鲜度</div>
          <div className={styles.dataCardContent}>
            <div className={styles.freshnessContainer}>
              <div className={styles.freshnessCircle}>98%</div>
              <div className={styles.dataStatGrid} style={{flex: 1}}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>最新更新时间</span>
                  <span className={styles.statValue}>2025-05-09 10:41</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>异常数据源</span>
                  <span className={styles.statValue}>1 个</span>
                </div>
              </div>
            </div>
            <a href="#" className={styles.evidenceLink}>查看数据详情</a>
          </div>
        </div>
        <div className={styles.dataCard}>
          <div className={styles.dataCardTitle}>可直接报名 SKU</div>
          <div className={styles.dataCardContent}>
            <div className={styles.bigNumber}>
              862 <span style={{fontSize: '14px', color: 'var(--ready)', background: 'rgba(31,157,98,0.1)', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle'}}>68.6%</span>
            </div>
            <div className={styles.dataStatGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>已通过</span>
                <span className={styles.statValue}>862</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>占比</span>
                <span className={styles.statValue}>68.6%</span>
              </div>
            </div>
            <a href="#" className={styles.evidenceLink}>查看清单</a>
          </div>
        </div>
        <div className={styles.dataCard}>
          <div className={styles.dataCardTitle}>待人工确认</div>
          <div className={styles.dataCardContent}>
            <div className={`${styles.bigNumber} ${styles.warning}`}>
              142 <span style={{fontSize: '14px', color: '#ff8b00', background: 'rgba(255,139,0,0.1)', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle'}}>11.3%</span>
            </div>
            <div className={styles.dataStatGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>需审批</span>
                <span className={styles.statValue}>142</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>高风险</span>
                <span className={styles.statValue}>37</span>
              </div>
            </div>
            <a href="#" className={styles.evidenceLink}>进入审核</a>
          </div>
        </div>
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>关键结论 (按风险优先) <span style={{color: 'var(--muted)', fontSize: '12px', fontWeight: 'normal'}}>ⓘ</span></div>
          <div className={styles.tableActions}>
            <button className="secondaryButton" style={{height: '32px', fontSize: '13px'}}><Filter size={14} style={{marginRight: '6px', verticalAlign: 'middle'}}/>筛选</button>
            <button className="secondaryButton" style={{height: '32px', fontSize: '13px'}}><Download size={14} style={{marginRight: '6px', verticalAlign: 'middle'}}/>导出</button>
          </div>
        </div>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th style={{width: '10%'}}>SKU</th>
              <th style={{width: '12%'}}>状态</th>
              <th style={{width: '40%'}}>主要原因</th>
              <th style={{width: '15%'}}>影响活动</th>
              <th style={{width: '12%'}}>下一步</th>
              <th style={{width: '11%'}}>证据</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>G003</td>
              <td><span className={styles.tagDanger}>不符合</span></td>
              <td>库存不足：活动价测算库存 &lt; 100 件 <span className="statusBadge statusBadge--neutral" style={{fontSize:'10px', height:'20px', minHeight:'20px', padding:'0 6px'}}>库存规则</span></td>
              <td>天猫618大促</td>
              <td>补货建议</td>
              <td><a href="#" className={styles.evidenceLink}>查看证据 ↗</a></td>
            </tr>
            <tr>
              <td>G004</td>
              <td><span className={styles.tagDanger}>不符合</span></td>
              <td>证书缺失：缺少 3C 证书 <span className="statusBadge statusBadge--neutral" style={{fontSize:'10px', height:'20px', minHeight:'20px', padding:'0 6px'}}>资质规则</span></td>
              <td>天猫618大促</td>
              <td>补全资料</td>
              <td><a href="#" className={styles.evidenceLink}>查看证据 ↗</a></td>
            </tr>
            <tr>
              <td>G006</td>
              <td><span className={styles.tagDanger}>不符合</span></td>
              <td>活动互斥：与“店铺周年庆”时间冲突 <span className="statusBadge statusBadge--neutral" style={{fontSize:'10px', height:'20px', minHeight:'20px', padding:'0 6px'}}>互斥规则</span></td>
              <td>天猫618大促</td>
              <td>排除并复核</td>
              <td><a href="#" className={styles.evidenceLink}>查看证据 ↗</a></td>
            </tr>
            <tr>
              <td>G012</td>
              <td><span className={styles.tagWarning}>待确认</span></td>
              <td>价格力不足：折扣力度 6.8% &lt; 规则要求 7% <span className="statusBadge statusBadge--neutral" style={{fontSize:'10px', height:'20px', minHeight:'20px', padding:'0 6px'}}>价格规则</span></td>
              <td>天猫618大促</td>
              <td>人工确认</td>
              <td><a href="#" className={styles.evidenceLink}>查看证据 ↗</a></td>
            </tr>
            <tr>
              <td>G018</td>
              <td><span className={styles.tagSuccess}>通过</span></td>
              <td>—</td>
              <td>天猫618大促</td>
              <td>可直接报名</td>
              <td><a href="#" className={styles.evidenceLink}>查看证据 ↗</a></td>
            </tr>
          </tbody>
        </table>
        <div className={styles.pagination}>
          <span>共 1,258 条</span>
          <div className={styles.pageControls}>
            <span style={{marginRight: '12px'}}>20 条/页 ∨</span>
            <button className={styles.pageBtn}><ChevronLeft size={16} /></button>
            <button className={`${styles.pageBtn} ${styles.active}`}>1</button>
            <button className={styles.pageBtn}>2</button>
            <button className={styles.pageBtn}>3</button>
            <button className={styles.pageBtn}>4</button>
            <button className={styles.pageBtn}>5</button>
            <span>...</span>
            <button className={styles.pageBtn}>63</button>
            <button className={styles.pageBtn}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
