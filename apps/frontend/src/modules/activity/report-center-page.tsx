'use client'

import React from 'react'
import { RefreshCw, Bell, Download, ChevronRight, Check, FileText, ChevronDown } from 'lucide-react'
import styles from './report-center.module.css'

export function ReportCenterPage() {
  return (
    <div className={styles.layout}>
      
      <div className={styles.topBar}>
        <div>
          <div className={styles.topBarTitle}>报告中心</div>
          <div className={styles.topBarSub}>查看任务执行结果与合规状态，识别风险并跟踪修复进展。</div>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnAction}><RefreshCw size={14} /> 刷新</button>
          <button className={styles.btnAction}><Bell size={14} /> 订阅报告</button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`}><Download size={14} /> 导出报告 <ChevronDown size={14} /></button>
        </div>
      </div>

      <div className={styles.mainBody}>
        
        {/* Left Panel */}
        <div className={styles.reportListPanel}>
          <div className={styles.listHeader}>
            报告列表
            <span style={{fontSize:'12px', color:'var(--muted)', display:'flex', alignItems:'center', gap:'4px', cursor:'pointer'}}>全部活动 <ChevronDown size={12} /></span>
          </div>
          
          <div className={`${styles.reportItem} ${styles.active}`}>
            <div className={styles.itemTitle}>天猫 618 执行报告 <span className={styles.itemBadge}>最新</span> <Check size={16} color="var(--primary)" style={{marginLeft:'auto'}}/></div>
            <div className={styles.itemMeta}>v3.0 &nbsp;&nbsp; 2025-05-23 10:22</div>
          </div>
          
          <div className={styles.reportItem}>
            <div className={styles.itemTitle}>天猫 618 执行报告</div>
            <div className={styles.itemMeta}>v2.1 &nbsp;&nbsp; 2025-05-23 09:15</div>
          </div>

          <div className={styles.reportItem}>
            <div className={styles.itemTitle}>天猫 618 执行报告</div>
            <div className={styles.itemMeta}>v1.0 &nbsp;&nbsp; 2025-05-22 18:40</div>
          </div>

          <div style={{marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--line)', textAlign: 'center'}}>
            <button className="secondaryButton" style={{width: '100%'}}>+ 对比报告</button>
          </div>
        </div>

        {/* Center Panel */}
        <div className={styles.centerPanel}>
          <div className={styles.centerHeader}>
            <div className={styles.reportTitleRow}>
              <div className={styles.reportTitle}>天猫 618 执行报告 <span className={styles.tagCompleted}>已完成</span></div>
              <div style={{color:'var(--primary)', fontSize:'14px', display:'flex', alignItems:'center', gap:'4px', cursor:'pointer'}}>收起 <ChevronDown size={14} style={{transform:'rotate(180deg)'}}/></div>
            </div>
            <div className={styles.reportMetaText}>
              <span>版本 v3.0</span>
              <span>执行任务 run_2025_05_23_1021</span>
              <span>生成时间 2025-05-23 10:22</span>
              <span>活动时间 2025-05-20 ~ 2025-06-20</span>
            </div>
          </div>

          <div className={styles.centerTabs}>
            <div className={`${styles.tab} ${styles.active}`}>执行摘要</div>
            <div className={styles.tab}>任务明细</div>
            <div className={styles.tab}>规则明细</div>
            <div className={styles.tab}>证据详情</div>
            <div className={styles.tab}>修复记录</div>
          </div>

          <div className={styles.centerBody}>
            
            <section>
              <div className={styles.sectionTitle}>活动概览</div>
              <div className={styles.overviewGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>涉及活动 SKU</div>
                  <div className={styles.statValue}>618</div>
                  <div className={styles.statChange}>较上次 <span className={styles.diffUp}>+18</span></div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>通过 SKU</div>
                  <div className={styles.statValue}>512 <small>82.8%</small></div>
                  <div className={styles.statChange}>较上次 <span className={styles.diffDown}>+26</span></div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>待修复 SKU</div>
                  <div className={styles.statValue}>78 <small>12.6%</small></div>
                  <div className={styles.statChange}>较上次 <span className={styles.diffDown}>-6</span></div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>阻断 SKU</div>
                  <div className={styles.statValue}>28 <small>4.5%</small></div>
                  <div className={styles.statChange}>较上次 <span className={styles.diffDown}>-2</span></div>
                </div>
              </div>
            </section>

            <section>
              <div className={styles.donutSection}>
                <div style={{flex: 1}}>
                  <div className={styles.sectionTitle}>SKU 准入结果</div>
                  <div style={{display:'flex', gap:'24px', alignItems:'center'}}>
                    <div className={styles.donutChart}>
                      <span style={{fontSize:'24px', fontWeight:600}}>618</span>
                      <span style={{fontSize:'13px', color:'var(--muted)'}}>总数</span>
                    </div>
                    <div>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px'}}>
                        <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#16a34a'}}></div>
                        <span style={{fontSize:'14px'}}>通过 512 (82.8%)</span>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px'}}>
                        <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#d97706'}}></div>
                        <span style={{fontSize:'14px'}}>待修复 78 (12.6%)</span>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                        <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#e11d48'}}></div>
                        <span style={{fontSize:'14px'}}>阻断 28 (4.5%)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{flex: 1}}>
                  <div className={styles.sectionTitle} style={{fontSize:'14px'}}>按类目分布 (TOP 5)</div>
                  <div className={styles.dataTable}>
                    <div className={`${styles.dataRow} ${styles.head}`}>
                      <span>类目</span>
                      <span>通过</span>
                      <span>待修复</span>
                      <span>阻断</span>
                      <span>通过率</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span>美妆护肤</span><span>146</span><span>18</span><span>6</span>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className={styles.barWrapper}><div className={styles.barFill} style={{width:'85%'}}></div></div>85.4%</div>
                    </div>
                    <div className={styles.dataRow}>
                      <span>个人护理</span><span>129</span><span>16</span><span>4</span>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className={styles.barWrapper}><div className={styles.barFill} style={{width:'84%'}}></div></div>84.9%</div>
                    </div>
                    <div className={styles.dataRow}>
                      <span>家清家居</span><span>96</span><span>10</span><span>2</span>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className={styles.barWrapper}><div className={styles.barFill} style={{width:'87%'}}></div></div>87.3%</div>
                    </div>
                    <div className={styles.dataRow}>
                      <span>母婴用品</span><span>78</span><span>9</span><span>1</span>
                      <div style={{display:'flex', alignItems:'center', gap:'8px'}}><div className={styles.barWrapper}><div className={styles.barFill} style={{width:'88%'}}></div></div>88.6%</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className={styles.sectionTitle}>主要风险</div>
              <div className={styles.dataTable}>
                <div className={`${styles.dataRow} ${styles.head}`}>
                  <span>风险类型</span>
                  <span>影响 SKU</span>
                  <span>占比</span>
                  <span>风险趋势</span>
                  <span>示例问题</span>
                </div>
                <div className={styles.dataRow}>
                  <span>识别所需数据字段缺失</span><span>23</span><span>37.1%</span>
                  <span style={{color:'#e11d48'}}>~~\\~~</span><span>缺少必填字段: brand_name、净含量</span>
                </div>
                <div className={styles.dataRow}>
                  <span>生成功能/价值宣称不合规</span><span>18</span><span>29.0%</span>
                  <span style={{color:'#e11d48'}}>~\\~~~</span><span>宣称词合规性不足: 美白、抗炎</span>
                </div>
                <div className={styles.dataRow}>
                  <span>执行商品准入判断不通过</span><span>12</span><span>19.4%</span>
                  <span style={{color:'#e11d48'}}>~~~\\~</span><span>类目/资质/功效宣称不通过</span>
                </div>
              </div>
            </section>

            <section>
              <div className={styles.sectionTitle}>修复建议</div>
              <div className={styles.dataTable}>
                <div className={`${styles.dataRow} ${styles.head}`}>
                  <span>优先级</span>
                  <span>建议</span>
                  <span>影响 SKU</span>
                  <span>预期修复率</span>
                  <span>操作</span>
                </div>
                <div className={styles.dataRow}>
                  <span style={{color:'#e11d48', background:'#fee2e2', padding:'2px 6px', borderRadius:'4px', display:'inline-block', width:'fit-content'}}>P0</span>
                  <span>补全识别所需必填字段 (brand_name、净含量等)</span><span>23</span><span>~37.1%</span>
                  <span style={{color:'var(--primary)', cursor:'pointer'}}>查看详情</span>
                </div>
                <div className={styles.dataRow}>
                  <span style={{color:'#d97706', background:'#fef3c7', padding:'2px 6px', borderRadius:'4px', display:'inline-block', width:'fit-content'}}>P1</span>
                  <span>移除/替换不合规宣称词, 使用平台允许表达</span><span>18</span><span>~29.0%</span>
                  <span style={{color:'var(--primary)', cursor:'pointer'}}>查看详情</span>
                </div>
              </div>
            </section>

            <section>
              <div className={styles.sectionTitle}>Review 结果</div>
              <div className={styles.reviewSection}>
                <div style={{display:'flex', gap:'24px'}}>
                  <span>需人工 Review 任务数 <b>22</b></span>
                  <span style={{color:'var(--muted)'}}>已完成 Review <b>18</b></span>
                  <span style={{color:'#16a34a'}}>通过 <b>15</b></span>
                  <span style={{color:'#e11d48'}}>退回 <b>3</b></span>
                </div>
                <div style={{color:'var(--primary)', cursor:'pointer', display:'flex', alignItems:'center'}}>查看全部 <ChevronRight size={14}/></div>
              </div>
            </section>

          </div>
        </div>

        {/* Right Panel */}
        <div className={styles.rightPanel}>
          
          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>报告版本</div>
            <div className={styles.versionSelect}>
              <div>
                <div style={{fontWeight:500}}>v3.0 (最新)</div>
                <div style={{fontSize:'12px', color:'var(--muted)'}}>2025-05-23 10:22</div>
              </div>
              <ChevronDown size={14} color="var(--muted)" />
            </div>
            <div style={{textAlign:'right', fontSize:'12px', color:'var(--primary)', cursor:'pointer', marginBottom:'16px'}}>版本说明</div>
            <button className="secondaryButton" style={{width:'100%'}}>切换版本</button>
          </div>

          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>导出报告</div>
            <div style={{fontSize:'13px', color:'var(--muted)', marginBottom:'12px'}}>选择格式</div>
            <div className={styles.exportFormatGrid}>
              <div className={`${styles.formatBtn} ${styles.active}`}>PDF</div>
              <div className={styles.formatBtn}>Excel</div>
              <div className={styles.formatBtn}>PPT</div>
            </div>
            
            <div className={styles.checkboxItem}>
              <input type="checkbox" checked readOnly />
              <span>包含图表与摘要 <span style={{color:'var(--primary)', fontSize:'12px'}}>(推荐)</span></span>
            </div>
            <div className={styles.checkboxItem} style={{marginBottom:'24px'}}>
              <input type="checkbox" readOnly />
              <span>包含明细数据</span>
            </div>

            <button className="primaryButton" style={{width:'100%'}}>导出</button>
          </div>

          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>报告信息</div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>报告 ID</div>
              <div className={styles.infoValue}>report_20250523_1022</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>生成方式</div>
              <div className={styles.infoValue}>自动生成</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>数据来源</div>
              <div className={styles.infoValue}>任务 run_2025_05_23_1021</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>规则版本</div>
              <div className={styles.infoValue}>v20250523</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.infoLabel}>生成耗时</div>
              <div className={styles.infoValue}>1 分 28 秒</div>
            </div>

            <button className="secondaryButton" style={{width:'100%', marginTop:'12px'}}><FileText size={14}/> 复制报告链接</button>
          </div>

          <div className={styles.widgetCard}>
            <div className={styles.widgetTitle}>订阅设置</div>
            <div style={{fontSize:'13px', color:'var(--muted)', marginBottom:'16px'}}>
              设置定期发送报告到邮箱或群组。
            </div>
            <button className="secondaryButton" style={{width:'100%'}}>去订阅</button>
          </div>

        </div>

      </div>
    </div>
  )
}
