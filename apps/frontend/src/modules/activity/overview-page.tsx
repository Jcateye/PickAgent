'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { FileText, Database, Plug, LayoutList, CheckCircle2, ChevronRight, Download, Filter, HelpCircle, FileCheck2, ChevronDown, Lock, ShieldAlert, Check } from 'lucide-react'
import type { SkuSummaryDto } from '../../../../contracts/types/businessFoundation'
import type { ReviewListItemDto } from '../../../../contracts/types/reviewReportCenter'
import { fetchActivityApi, type HealthSummaryDto, type PageDto } from './api-client'
import styles from './overview.module.css'

export function OverviewPage() {
  const [summary, setSummary] = useState<HealthSummaryDto | null>(null)
  const [skuPage, setSkuPage] = useState<PageDto<SkuSummaryDto> | null>(null)
  const [reviewPage, setReviewPage] = useState<PageDto<ReviewListItemDto> | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchActivityApi<HealthSummaryDto>('/api/health/summary'),
      fetchActivityApi<PageDto<SkuSummaryDto>>('/api/skus?pageSize=5'),
      fetchActivityApi<PageDto<ReviewListItemDto>>('/api/reviews?pageSize=20'),
    ])
      .then(([nextSummary, nextSkuPage, nextReviewPage]) => {
        if (cancelled) return
        setSummary(nextSummary)
        setSkuPage(nextSkuPage)
        setReviewPage(nextReviewPage)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const overview = useMemo(() => {
    const total = summary?.total ?? 1258
    const ready = summary?.ready ?? 862
    const blocked = summary?.blocked ?? 8
    const reviewCount = reviewPage?.total ?? 142
    return {
      total,
      ready,
      blocked,
      reviewCount,
      readyRate: total > 0 ? `${((ready / total) * 100).toFixed(1)}%` : '0.0%',
    }
  }, [reviewPage?.total, summary])

  const apiRows = skuPage?.items?.length ? skuPage.items : null

  return (
    <div className={styles.layout}>
      {/* Left Main Content */}
      <div className={styles.mainContent}>
        
        {/* Header Summary */}
        <div className={styles.pageHeader}>
          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>执行天猫618选品规则检查</h1>
            <div className={styles.runningBadge}>
              <div className={styles.pulseDot}></div>
              运行中
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--fg)', marginBottom: '8px' }}>
            <strong>目标：</strong>解析并校验天猫618选品规则，识别不符合项，生成可报名 SKU 清单与待处理项。
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            <strong>下一步：</strong>完成准入模拟，生成 Review 清单并进入人工确认。
          </div>
          
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>证据摘要</span>
              <div className={styles.evidenceRow} style={{ marginTop: '12px' }}>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><FileCheck2 size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>规则版本</span>
                    <span className={styles.evidenceData}>v3.2.1</span>
                    <a href="#" className={styles.evidenceLink}>查看规则</a>
                  </div>
                </div>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><Database size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>数据源</span>
                    <span className={styles.evidenceData}>8/8 正常</span>
                    <a href="#" className={styles.evidenceLink}>查看数据</a>
                  </div>
                </div>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><Plug size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>插件任务</span>
                    <span className={styles.evidenceData}>12/12 成功</span>
                    <a href="#" className={styles.evidenceLink}>查看 Run</a>
                  </div>
                </div>
                <div className={styles.evidenceCard}>
                  <div className={styles.evidenceIcon}><LayoutList size={20} /></div>
                  <div className={styles.evidenceContent}>
                    <span className={styles.evidenceTitle}>诊断结果</span>
                    <span className={styles.evidenceData}>{overview.total.toLocaleString()} 个 SKU</span>
                    <a href="#" className={styles.evidenceLink}>查看证据</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className={styles.stepperContainer}>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.completed}`}><Check size={16} /></div>
            <div className={styles.stepLabel}>1 规则解析</div>
            <div className={styles.stepStatus}>已完成</div>
            <div className={styles.stepTime}>05-09 10:33</div>
            <div className={`${styles.stepLine} ${styles.completed}`}></div>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.completed}`}><Check size={16} /></div>
            <div className={styles.stepLabel}>2 数据检查</div>
            <div className={styles.stepStatus}>已完成</div>
            <div className={styles.stepTime}>05-09 10:36</div>
            <div className={`${styles.stepLine} ${styles.completed}`}></div>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.completed}`}><Check size={16} /></div>
            <div className={styles.stepLabel}>3 插件采集</div>
            <div className={styles.stepStatus}>已完成</div>
            <div className={styles.stepTime}>05-09 10:41</div>
            <div className={`${styles.stepLine} ${styles.running}`}></div>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.running}`}>4</div>
            <div className={styles.stepLabel} style={{ color: 'var(--primary)' }}>4 SKU 诊断</div>
            <div className={styles.stepStatus} style={{ color: 'var(--primary)' }}>运行中</div>
            <div className={styles.stepTime}>预计 2 分钟</div>
            <div className={`${styles.stepLine} ${styles.waiting}`}></div>
          </div>
          <div className={styles.stepItem}>
            <div className={`${styles.stepIcon} ${styles.waiting}`}>5</div>
            <div className={styles.stepLabel}>5 准入模拟</div>
            <div className={styles.stepStatus}>待开始</div>
            <div className={styles.stepTime}>—</div>
            <div className={`${styles.stepLine} ${styles.waiting}`}></div>
          </div>
          <div className={styles.stepItem} style={{ flex: 0, minWidth: '80px' }}>
            <div className={`${styles.stepIcon} ${styles.waiting}`}>6</div>
            <div className={styles.stepLabel}>6 Review 生成</div>
            <div className={styles.stepStatus}>待开始</div>
          </div>
        </div>

        {/* Indicators */}
        <div className={styles.indicatorsRow}>
          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>规则解析</div>
            <div className={styles.indicatorMain}>
              <div className={styles.indicatorBigValue}>v3.2.1</div>
              <div className={styles.ruleVersionBadge}>已更新</div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginTop: 'auto', marginBottom: '16px' }}>
              <span>规则条款 <span className={styles.indicatorMetaVal}>28 条</span></span>
              <span>关键限制项 <span className={styles.indicatorMetaVal}>12 条</span></span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href="#" className={styles.evidenceLink}>查看规则</a>
            </div>
          </div>

          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>数据新鲜度</div>
            <div className={styles.donutWrapper}>
              <div className={styles.donutCircle}>
                <div className={styles.donutInner}>98%</div>
              </div>
              <div className={styles.donutMeta}>
                <div style={{ color: 'var(--muted)' }}>整体新鲜度</div>
                <div style={{ color: 'var(--fg)', fontWeight: 500 }}>最新更新时间</div>
                <div>2025-05-09 10:41</div>
              </div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginBottom: '16px' }}>
              <span>异常数据源</span>
              <span className={styles.indicatorMetaVal} style={{ color: '#ef4444' }}>1 个</span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href="#" className={styles.evidenceLink}>查看数据详情</a>
            </div>
          </div>

          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>可直接报名 SKU</div>
            <div className={styles.indicatorMain}>
              <div className={`${styles.indicatorBigValue} ${styles.green}`}>{overview.ready.toLocaleString()}</div>
              <div className={`${styles.indicatorSubValue} ${styles.green}`}>{overview.readyRate}</div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginTop: 'auto', marginBottom: '16px' }}>
              <span>已通过 <span className={styles.indicatorMetaVal}>{overview.ready.toLocaleString()}</span></span>
              <span>占比 <span className={styles.indicatorMetaVal}>{overview.readyRate}</span></span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href="#" className={styles.evidenceLink}>查看清单</a>
            </div>
          </div>

          <div className={styles.indicatorCard}>
            <div className={styles.indicatorTitle}>待人工确认</div>
            <div className={styles.indicatorMain}>
              <div className={`${styles.indicatorBigValue} ${styles.orange}`}>{overview.reviewCount.toLocaleString()}</div>
              <div className={`${styles.indicatorSubValue} ${styles.orange}`}>11.3%</div>
            </div>
            <div className={styles.indicatorMetaRow} style={{ marginTop: 'auto', marginBottom: '16px' }}>
              <span>需审批 <span className={styles.indicatorMetaVal}>{overview.reviewCount.toLocaleString()}</span></span>
              <span>阻塞 <span className={styles.indicatorMetaVal}>{overview.blocked.toLocaleString()}</span></span>
            </div>
            <div className={styles.indicatorFooter}>
              <a href="#" className={styles.evidenceLink}>进入审核</a>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <div className={styles.tableTitle}>
              关键结论 (按风险优先)
              <HelpCircle size={14} color="var(--muted)" style={{ cursor: 'pointer' }} />
            </div>
            <div className={styles.tableActions}>
              <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>
                全部状态 <ChevronDown size={14} />
              </button>
              <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>
                <Filter size={14} /> 筛选
              </button>
              <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>
                <Download size={14} /> 导出
              </button>
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>状态</th>
                  <th>主要原因</th>
                  <th>影响活动</th>
                  <th>下一步</th>
                  <th>证据</th>
                </tr>
              </thead>
              <tbody>
                {apiRows ? apiRows.map((item) => (
                  <tr key={item.skuProfileId}>
                    <td>{item.canonicalSkuKey}</td>
                    <td><span className={`${styles.statusTag} ${item.healthStatus === 'READY' ? styles.success : item.healthStatus === 'WARNING' ? styles.warning : styles.danger}`}>{item.healthStatus === 'READY' ? '通过' : item.healthStatus === 'WARNING' ? '待确认' : '不符合'}</span></td>
                    <td>{item.topIssues?.[0] ?? '—'} <span className={styles.ruleTag}>健康诊断</span></td>
                    <td>天猫618大促</td>
                    <td>{item.nextActions?.[0] ?? (item.healthStatus === 'READY' ? '可直接报名' : '人工确认')}</td>
                    <td><a href={`/sku-health/${item.skuProfileId}`} className={styles.evidenceLink}>查看证据 <ChevronRight size={14} /></a></td>
                  </tr>
                )) : (
                  <>
                    <tr>
                      <td>G003</td>
                      <td><span className={`${styles.statusTag} ${styles.danger}`}>不符合</span></td>
                      <td>库存不足：活动价测算库存 &lt; 100 件 <span className={styles.ruleTag}>库存规则</span></td>
                      <td>天猫618大促</td>
                      <td>补货建议</td>
                      <td><a href="#" className={styles.evidenceLink}>查看证据 <ChevronRight size={14} /></a></td>
                    </tr>
                    <tr>
                      <td>G012</td>
                      <td><span className={`${styles.statusTag} ${styles.warning}`}>待确认</span></td>
                      <td>价格力不足：折扣力度 6.8% &lt; 规则要求 7% <span className={styles.ruleTag}>价格规则</span></td>
                      <td>天猫618大促</td>
                      <td>人工确认</td>
                      <td><a href="#" className={styles.evidenceLink}>查看证据 <ChevronRight size={14} /></a></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.tablePagination}>
            <span>共 {overview.total.toLocaleString()} 条</span>
            <div className={styles.pageControls}>
              <button className="secondaryButton" style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}>20 条/页 <ChevronDown size={14} /></button>
              <div className={styles.pageBtn}><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }}/></div>
              <div className={`${styles.pageBtn} ${styles.active}`}>1</div>
              <div className={styles.pageBtn}>2</div>
              <div className={styles.pageBtn}>3</div>
              <div className={styles.pageBtn}>4</div>
              <div className={styles.pageBtn}>5</div>
              <span>...</span>
              <div className={styles.pageBtn}>63</div>
              <div className={styles.pageBtn}><ChevronRight size={14} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.consoleHeader}>
          <div className={styles.consoleTitle}>Agent Mission Console</div>
          <div className={styles.consoleActions}>
            <ChevronDown size={16} style={{ cursor: 'pointer' }} />
            <ChevronRight size={16} style={{ cursor: 'pointer' }} />
          </div>
        </div>

        <div className={styles.consoleSection}>
          <div className={styles.consoleRunId}>
            <span>最新 Run：#20250509-1041</span>
            <span className={styles.consoleRunBadge}>运行中</span>
          </div>
          
          <div className={styles.stepListTitle}>执行步骤</div>
          
          <div className={`${styles.vStep} ${styles.completed}`}>
            <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
            <div className={styles.vStepContent}>
              <span className={styles.vStepLabel}>1. 规则解析</span>
              <div className={styles.vStepStatus}>
                <span className={`${styles.statusBadge} ${styles.completed}`}>已完成</span>
                <span className={styles.vStepTime}>10:33</span>
              </div>
            </div>
          </div>
          
          <div className={`${styles.vStep} ${styles.completed}`}>
            <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
            <div className={styles.vStepContent}>
              <span className={styles.vStepLabel}>2. 数据检查</span>
              <div className={styles.vStepStatus}>
                <span className={`${styles.statusBadge} ${styles.completed}`}>已完成</span>
                <span className={styles.vStepTime}>10:36</span>
              </div>
            </div>
          </div>
          
          <div className={`${styles.vStep} ${styles.completed}`}>
            <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
            <div className={styles.vStepContent}>
              <span className={styles.vStepLabel}>3. 插件采集</span>
              <div className={styles.vStepStatus}>
                <span className={`${styles.statusBadge} ${styles.completed}`}>已完成</span>
                <span className={styles.vStepTime}>10:41</span>
              </div>
            </div>
          </div>
          
          <div className={`${styles.vStep} ${styles.running}`}>
            <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
            <div className={styles.vStepContent}>
              <span className={styles.vStepLabel}>4. SKU 诊断</span>
              <div className={styles.vStepStatus}>
                <span className={`${styles.statusBadge} ${styles.running}`}>运行中</span>
                <span className={styles.vStepTime}>10:41</span>
              </div>
            </div>
          </div>
          
          <div className={styles.vStep}>
            <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
            <div className={styles.vStepContent}>
              <span className={styles.vStepLabel}>5. 准入模拟</span>
              <div className={styles.vStepStatus}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>排队中</span>
                <span className={styles.vStepTime}>—</span>
              </div>
            </div>
          </div>
          
          <div className={styles.vStep}>
            <div className={styles.vStepIndicator}><div className={styles.vStepCircle}></div></div>
            <div className={styles.vStepContent}>
              <span className={styles.vStepLabel}>6. Review 生成</span>
              <div className={styles.vStepStatus}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>等待中</span>
                <span className={styles.vStepTime}>—</span>
              </div>
            </div>
          </div>

        </div>

        <div className={styles.consoleSection}>
          <div className={styles.stepListTitle} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span>工具运行状态 (12/12)</span>
            <ChevronDown size={14} />
          </div>
          
          <div className={styles.toolsList}>
            <div className={styles.toolItem}>
              <div className={styles.toolName}><FileText size={14} /> 商品数据采集</div>
              <div className={styles.toolStatus}>
                <span className={styles.toolSuccessText}>成功</span>
                <span className={styles.toolTime}>10:35</span>
              </div>
            </div>
            <div className={styles.toolItem}>
              <div className={styles.toolName}><CheckCircle2 size={14} /> 库存与价格校验</div>
              <div className={styles.toolStatus}>
                <span className={styles.toolSuccessText}>成功</span>
                <span className={styles.toolTime}>10:36</span>
              </div>
            </div>
            <div className={styles.toolItem}>
              <div className={styles.toolName}><FileCheck2 size={14} /> 资质校验</div>
              <div className={styles.toolStatus}>
                <span className={styles.toolSuccessText}>成功</span>
                <span className={styles.toolTime}>10:37</span>
              </div>
            </div>
            <div className={styles.toolItem}>
              <div className={styles.toolName}><ShieldAlert size={14} /> 活动互斥校验</div>
              <div className={styles.toolStatus}>
                <span className={styles.toolSuccessText}>成功</span>
                <span className={styles.toolTime}>10:38</span>
              </div>
            </div>
            <div className={styles.toolItem}>
              <div className={styles.toolName}><Database size={14} /> 历史报名校验</div>
              <div className={styles.toolStatus}>
                <span className={styles.toolSuccessText}>成功</span>
                <span className={styles.toolTime}>10:39</span>
              </div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>...</div>
            <a href="#" className={styles.evidenceLink} style={{ marginTop: '4px' }}>查看全部工具 Run</a>
          </div>
        </div>

        <div className={styles.consoleSection}>
          <div className={styles.lockSection}>
            <div className={styles.lockHeader}>
              <span>工具 Trace (已折叠)</span>
              <Lock size={14} color="var(--muted)" />
            </div>
            <div className={styles.lockDesc}>包含请求/响应、原始字段与日志</div>
            <a href="#" className={styles.evidenceLink} style={{ marginTop: '4px' }}>查看 Trace</a>
          </div>
        </div>
      </div>
    </div>
  )
}
