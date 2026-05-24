'use client'

import React, { useState } from 'react'
import { ChevronRight, RefreshCw, Plus, Globe, Database, ArrowDownUp, FileSpreadsheet, MoreVertical, X, Check, CheckCircle2 } from 'lucide-react'
import styles from './data-sources.module.css'

export function DataSourcesPage() {
  const [selectedConnector, setSelectedConnector] = useState<string | null>('chrome')

  return (
    <div className={styles.layout}>
      
      <div className={styles.mainContent}>
        <div className={styles.pageHeader}>
          数据源 <ChevronRight size={14} /> 连接器与最近采集
        </div>

        <h1 className={styles.pageTitle}>数据源连接器</h1>
        <div className={styles.pageDesc}>管理数据连接器，监控采集运行状态与数据新鲜度</div>

        <div className={styles.sectionHeader} style={{marginTop: '16px'}}>
          <div className={styles.sectionTitle}>连接器概览</div>
          <div style={{display:'flex', gap:'12px'}}>
            <button className="secondaryButton" style={{width:'32px', padding:0, display:'flex', justifyContent:'center'}}><RefreshCw size={14}/></button>
            <button className="primaryButton"><Plus size={14} /> 添加连接器</button>
          </div>
        </div>

        <div className={styles.connectorList}>
          {/* Chrome Plugin */}
          <div className={`${styles.connectorCard} ${selectedConnector === 'chrome' ? styles.selected : ''}`} onClick={() => setSelectedConnector('chrome')}>
            <div className={styles.connectorInfo}>
              <div className={`${styles.connectorIcon} ${styles.cChrome}`}><Globe size={20} /></div>
              <div>
                <div className={styles.connectorName}>
                  浏览器插件
                  <span className={`${styles.statusTag} ${styles.statusActive}`}><div className={styles.dot} style={{background:'#16a34a', marginRight:0}}></div> 运行中</span>
                </div>
                <div className={styles.connectorMeta}>
                  <span>最后同步 10:21</span>
                  <span>数据新鲜度 2 分钟前</span>
                </div>
              </div>
            </div>
            <div className={styles.connectorActions}>
              <button className="secondaryButton">查看运行</button>
              <MoreVertical size={16} color="var(--muted)" />
            </div>
          </div>

          {/* ERP */}
          <div className={styles.connectorCard}>
            <div className={styles.connectorInfo}>
              <div className={`${styles.connectorIcon} ${styles.cErp}`}><Database size={20} /></div>
              <div>
                <div className={styles.connectorName}>
                  ERP
                  <span className={`${styles.statusTag} ${styles.statusActive}`}><div className={styles.dot} style={{background:'#16a34a', marginRight:0}}></div> 运行中</span>
                </div>
                <div className={styles.connectorMeta}>
                  <span>最后同步 10:18</span>
                  <span>数据新鲜度 5 分钟前</span>
                </div>
              </div>
            </div>
            <div className={styles.connectorActions}>
              <button className="secondaryButton">查看运行</button>
              <MoreVertical size={16} color="var(--muted)" />
            </div>
          </div>

          {/* Platform API */}
          <div className={styles.connectorCard}>
            <div className={styles.connectorInfo}>
              <div className={`${styles.connectorIcon} ${styles.cApi}`}><ArrowDownUp size={20} /></div>
              <div>
                <div className={styles.connectorName}>
                  平台 API
                  <span className={`${styles.statusTag} ${styles.statusActive}`}><div className={styles.dot} style={{background:'#16a34a', marginRight:0}}></div> 运行中</span>
                </div>
                <div className={styles.connectorMeta}>
                  <span>最后同步 10:20</span>
                  <span>数据新鲜度 3 分钟前</span>
                </div>
              </div>
            </div>
            <div className={styles.connectorActions}>
              <button className="secondaryButton">查看运行</button>
              <MoreVertical size={16} color="var(--muted)" />
            </div>
          </div>

          {/* CSV Import */}
          <div className={styles.connectorCard}>
            <div className={styles.connectorInfo}>
              <div className={`${styles.connectorIcon} ${styles.cCsv}`}><FileSpreadsheet size={20} /></div>
              <div>
                <div className={styles.connectorName}>
                  CSV 导入
                  <span className={`${styles.statusTag} ${styles.statusPaused}`}><div className={styles.dot} style={{background:'#64748b', marginRight:0}}></div> 已暂停</span>
                </div>
                <div className={styles.connectorMeta}>
                  <span>最后同步 昨天 18:45</span>
                  <span>数据新鲜度 16 小时前</span>
                </div>
              </div>
            </div>
            <div className={styles.connectorActions}>
              <button className="secondaryButton">上传文件</button>
              <MoreVertical size={16} color="var(--muted)" />
            </div>
          </div>
        </div>

        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>最近采集运行</div>
          <div style={{display:'flex', gap:'12px'}}>
            <select className="secondaryButton" style={{appearance:'none', width:'120px'}}>
              <option>全部数据源</option>
            </select>
            <button className="secondaryButton" style={{width:'32px', padding:0, display:'flex', justifyContent:'center'}}><RefreshCw size={14}/></button>
          </div>
        </div>

        <div className={styles.recentRunsTable}>
          <div className={styles.tableHeader}>
            <div>运行 ID</div>
            <div>数据源</div>
            <div>采集行数</div>
            <div>数据新鲜度</div>
            <div>结果</div>
            <div>证据质量 ⓘ</div>
            <div>运行时间</div>
          </div>
          
          <div className={styles.tableRow}>
            <div style={{color:'var(--muted)'}}>run_2025_05_23_1021</div>
            <div style={{display:'flex', alignItems:'center', gap:'6px'}}><Globe size={14} color="#ea4335" /> 浏览器插件</div>
            <div>1,248</div>
            <div><span className={styles.dotGreen}></span>2 分钟前</div>
            <div style={{color:'#16a34a'}}><Check size={14}/> 成功</div>
            <div><span className={styles.dotGreen}></span>高 0.92</div>
            <div>10:21</div>
          </div>

          <div className={styles.tableRow}>
            <div style={{color:'var(--muted)'}}>run_2025_05_23_1018</div>
            <div style={{display:'flex', alignItems:'center', gap:'6px'}}><Database size={14} color="#2563eb" /> ERP</div>
            <div>8,732</div>
            <div><span className={styles.dotGreen}></span>5 分钟前</div>
            <div style={{color:'#16a34a'}}><Check size={14}/> 成功</div>
            <div><span className={styles.dotGreen}></span>高 0.90</div>
            <div>10:18</div>
          </div>

          <div className={styles.tableRow}>
            <div style={{color:'var(--muted)'}}>run_2025_05_23_1020</div>
            <div style={{display:'flex', alignItems:'center', gap:'6px'}}><ArrowDownUp size={14} color="#0ea5e9" /> 平台 API</div>
            <div>2,156</div>
            <div><span className={styles.dotGreen}></span>3 分钟前</div>
            <div style={{color:'#16a34a'}}><Check size={14}/> 成功</div>
            <div><span className={styles.dotOrange}></span>中 0.78</div>
            <div>10:20</div>
          </div>

          <div className={styles.tableRow}>
            <div style={{color:'var(--muted)'}}>run_2025_05_22_1845</div>
            <div style={{display:'flex', alignItems:'center', gap:'6px'}}><FileSpreadsheet size={14} color="#16a34a" /> CSV 导入</div>
            <div>934</div>
            <div><span className={styles.dotOrange}></span>16 小时前</div>
            <div style={{color:'#16a34a'}}><Check size={14}/> 成功</div>
            <div><span className={styles.dotOrange}></span>中 0.65</div>
            <div>昨天 18:45</div>
          </div>
          
          <div className={styles.tableRow}>
            <div style={{color:'var(--muted)'}}>run_2025_05_22_1022</div>
            <div style={{display:'flex', alignItems:'center', gap:'6px'}}>CRM (API)</div>
            <div>672</div>
            <div><span className={styles.dotRed}></span>1 天前</div>
            <div style={{color:'#dc2626'}}><X size={14}/> 失败</div>
            <div><span className={styles.dotRed}></span>低 0.38</div>
            <div>昨天 10:22</div>
          </div>

          <div style={{padding:'12px 16px', fontSize:'13px', color:'var(--muted)', display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--line)'}}>
            <div>共 5 条</div>
            <div style={{display:'flex', gap:'8px'}}>
              <button className="secondaryButton" style={{padding:'2px 8px'}}>&lt;</button>
              <button className="primaryButton" style={{padding:'2px 8px'}}>1</button>
              <button className="secondaryButton" style={{padding:'2px 8px'}}>&gt;</button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {selectedConnector === 'chrome' && (
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <div style={{flex: 1}}>
              <div className={styles.panelTitle}>
                <Globe size={20} color="#ea4335" /> 浏览器插件
                <span className={`${styles.statusTag} ${styles.statusActive}`} style={{marginLeft:'auto', fontWeight: 400}}><div className={styles.dot} style={{background:'#16a34a', marginRight:0}}></div> 运行中</span>
              </div>
              <div className={styles.panelTabs}>
                <div className={`${styles.panelTab} ${styles.active}`}>概览</div>
                <div className={styles.panelTab}>配置</div>
                <div className={styles.panelTab}>权限</div>
              </div>
            </div>
            <div style={{cursor:'pointer'}} onClick={() => setSelectedConnector(null)}><X size={18} color="var(--muted)"/></div>
          </div>

          <div className={styles.panelBody}>
            <div className={styles.blockTitle}>
              当前配置
              <button className="secondaryButton" style={{fontSize:'12px', padding:'4px 8px'}}>编辑配置</button>
            </div>
            <div className={styles.configList}>
              <div className={styles.configRow}><div className={styles.configLabel}>插件版本</div><div className={styles.configValue}>v2.1.3</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>采集范围</div><div className={styles.configValue}>1688.com (商品详情页)</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>采集字段</div><div className={styles.configValue}>30 个字段</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>采集频率</div><div className={styles.configValue}>实时采集</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>去重规则</div><div className={styles.configValue}>URL + SKU</div></div>
              <div className={styles.configRow}><div className={styles.configLabel}>数据存储</div><div className={styles.configValue}>SKU Ready DB</div></div>
            </div>

            <div className={styles.blockTitle}>权限摘要</div>
            <div className={styles.authCards}>
              <div className={styles.authCard}>
                <div className={styles.authVal}>1 个</div>
                <div className={styles.authLabel}>已授权域名</div>
              </div>
              <div className={styles.authCard}>
                <div className={styles.authVal}>读取</div>
                <div className={styles.authLabel}>账号权限</div>
              </div>
              <div className={styles.authCard}>
                <div className={styles.authVal}>本团队</div>
                <div className={styles.authLabel}>数据可见范围</div>
              </div>
            </div>

            <div className={styles.blockTitle}>
              最近运行
              <span style={{color:'var(--primary)', fontSize:'13px', cursor:'pointer', fontWeight:400}}>查看全部</span>
            </div>
            <div className={styles.recentRunsSmall}>
              <div className={styles.runItem}>
                <div style={{display:'flex', alignItems:'center', gap:'6px'}}><span className={styles.dotGreen}></span> run_2025_05...1021</div>
                <div className={styles.success}>成功</div>
                <div style={{color:'var(--muted)'}}>10:21</div>
              </div>
              <div className={styles.runItem}>
                <div style={{display:'flex', alignItems:'center', gap:'6px'}}><span className={styles.dotGreen}></span> run_2025_05...1010</div>
                <div className={styles.success}>成功</div>
                <div style={{color:'var(--muted)'}}>10:10</div>
              </div>
              <div className={styles.runItem}>
                <div style={{display:'flex', alignItems:'center', gap:'6px'}}><span className={styles.dotGreen}></span> run_2025_05...0958</div>
                <div className={styles.success}>成功</div>
                <div style={{color:'var(--muted)'}}>09:58</div>
              </div>
            </div>

            <div className={styles.blockTitle}>
              运行告警
              <span style={{color:'var(--primary)', fontSize:'13px', cursor:'pointer', fontWeight:400}}>查看全部</span>
            </div>
            <div className={styles.alertBox}>
              <div className={styles.alertIcon}><CheckCircle2 size={16} /></div>
              <div>
                <div style={{fontWeight:600, fontSize:'14px', marginBottom:'2px'}}>暂无告警</div>
                <div style={{fontSize:'12px', color:'var(--muted)'}}>最近 7 天内无告警</div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
