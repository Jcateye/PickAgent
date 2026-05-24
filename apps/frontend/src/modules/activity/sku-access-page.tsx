'use client'

import React, { useState } from 'react'
import { CheckCircle2, Wrench, HelpCircle, XCircle, Search, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './sku-access.module.css'

export function SkuAccessPage() {
  const [drawerOpen, setDrawerOpen] = useState(true)

  return (
    <div className={styles.layout}>
      <div className={styles.mainArea}>
        <div className="pageHeader">
          <div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>SKU 准入工作台</h1>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>按 SKU 维度查看准入状态、核心原因与下一步建议，可批量处理并生成 Review。</p>
          </div>
        </div>

        <div className={styles.filterBar}>
          <div className={styles.filterItem}>
            活动
            <select className={styles.filterSelect}>
              <option>天猫618大促</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            平台
            <select className={styles.filterSelect}>
              <option>全部</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            类目
            <select className={styles.filterSelect}>
              <option>全部</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            状态
            <select className={styles.filterSelect}>
              <option>全部</option>
            </select>
          </div>
          <div style={{ flex: 1 }}></div>
          <div className={styles.searchBox}>
            <Search size={16} color="var(--muted)" />
            <input type="text" placeholder="搜索 SKU / 商品名 / SPU" />
          </div>
          <button className="secondaryButton" style={{ height: '32px' }}>重置</button>
        </div>

        <div className={styles.summaryCards}>
          <div className={`${styles.summaryCard} ${styles.active}`}>
            <div className={styles.cardHeader}>
              <CheckCircle2 size={16} className={styles.iconReady} />
              可直接报名
            </div>
            <div className={styles.cardValue}>862 <span className={styles.cardPct}>68.6%</span></div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <Wrench size={16} className={styles.iconRepair} />
              可修复
            </div>
            <div className={styles.cardValue}>246 <span className={styles.cardPct}>19.5%</span></div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <HelpCircle size={16} className={styles.iconReview} />
              待人工确认
            </div>
            <div className={styles.cardValue}>142 <span className={styles.cardPct}>11.3%</span></div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeader}>
              <XCircle size={16} className={styles.iconBlocked} />
              不建议报名
            </div>
            <div className={styles.cardValue}>8 <span className={styles.cardPct}>0.6%</span></div>
          </div>
        </div>

        <div className={styles.tableToolbar}>
          <div className={styles.tableToolbarLeft}>已选择 1 项</div>
          <div className={styles.tableToolbarRight}>
            <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>批量生成 Review</button>
            <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>批量设置下一步 ∨</button>
            <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>导出当前结果</button>
            <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>更多 ∨</button>
          </div>
        </div>

        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}><input type="checkbox" /></th>
              <th>SKU</th>
              <th style={{ width: '20%' }}>商品名</th>
              <th>类目</th>
              <th>状态</th>
              <th style={{ width: '18%' }}>主要原因</th>
              <th style={{ width: '15%' }}>下一步</th>
              <th>证据</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.rowActive}>
              <td><input type="checkbox" checked readOnly /></td>
              <td>G003</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>天猫精灵 智能音箱 X5 (深空灰)</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>3C 数码 &gt; 智能设备</td>
              <td><span className={styles.tagReady}>通过</span></td>
              <td>所有规则通过</td>
              <td>可直接报名</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (5)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
            <tr>
              <td><input type="checkbox" /></td>
              <td>G004</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>小米 67W 氮化镓充电器套装</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>3C 数码 &gt; 配件</td>
              <td><span className={styles.tagRepair}>可修复</span></td>
              <td>详情页图缺失；<br />包装图不合规</td>
              <td>补全详情页图；<br />替换包装图</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (3)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
            <tr>
              <td><input type="checkbox" /></td>
              <td>G006</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>JBL GO 4 便携蓝牙音箱</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>3C 数码 &gt; 音频设备</td>
              <td><span className={styles.tagRepair}>可修复</span></td>
              <td>标题格式不规范；<br />缺少3C证书</td>
              <td>优化标题；<br />补充3C证书</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (4)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
            <tr>
              <td><input type="checkbox" /></td>
              <td>D001</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>舒肤佳柠檬清香沐浴露 720ml</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>个护美妆 &gt; 沐浴护理</td>
              <td><span className={styles.tagReview}>待确认</span></td>
              <td>功效宣称需人工确认</td>
              <td>人工确认</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (2)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
            <tr>
              <td><input type="checkbox" /></td>
              <td>D002</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>百草味 每日坚果 750g</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>食品 &gt; 休闲零食</td>
              <td><span className={styles.tagBlocked}>不建议</span></td>
              <td>历史报名校验失败 (近30天低价风险)</td>
              <td>不建议报名</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (5)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
            <tr>
              <td><input type="checkbox" /></td>
              <td>G010</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>罗技 M331静音无线鼠标</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>3C 数码 &gt; 电脑配件</td>
              <td><span className={styles.tagRepair}>可修复</span></td>
              <td>主图不清晰；详情页图缺失</td>
              <td>优化主图；<br />补全详情页图</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (2)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
            <tr>
              <td><input type="checkbox" /></td>
              <td>H012</td>
              <td className={styles.productCell}>
                <span className={styles.productName}>全棉时代 纯棉柔巾 100抽*6包</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>母婴 &gt; 婴童用品</td>
              <td><span className={styles.tagReady}>通过</span></td>
              <td>所有规则通过</td>
              <td>可直接报名</td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>查看证据 (3)</a></td>
              <td><a href="#" style={{ color: 'var(--primary)' }}>生成</a></td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', fontSize: '13px', color: 'var(--muted)' }}>
          <span>共 1,258 条</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>20 条/页 ∨</span>
            <button className="iconButton" style={{ width: '28px', height: '28px' }}><ChevronLeft size={16} /></button>
            <button className="primaryButton" style={{ width: '28px', height: '28px', padding: 0 }}>1</button>
            <button className="secondaryButton" style={{ width: '28px', height: '28px', padding: 0 }}>2</button>
            <button className="secondaryButton" style={{ width: '28px', height: '28px', padding: 0 }}>3</button>
            <button className="secondaryButton" style={{ width: '28px', height: '28px', padding: 0 }}>4</button>
            <button className="secondaryButton" style={{ width: '28px', height: '28px', padding: 0 }}>5</button>
            <span>...</span>
            <button className="secondaryButton" style={{ width: '28px', height: '28px', padding: 0 }}>63</button>
            <button className="iconButton" style={{ width: '28px', height: '28px' }}><ChevronRight size={16} /></button>
          </div>
        </div>

      </div>

      {drawerOpen && (
        <div className={styles.sidePanel}>
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitle}>G003</div>
            <button className="iconButton" style={{ border: 'none' }} onClick={() => setDrawerOpen(false)}>
              <X size={18} color="var(--muted)" />
            </button>
          </div>
          <div className={styles.drawerProductInfo}>
            <div className={styles.productImg}>
              <div className={styles.productImgPlaceholder}></div>
            </div>
            <div className={styles.productMeta}>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>天猫精灵 智能音箱 X5 (深空灰)</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                SPU: 5101234567 <Copy size={12} />
              </div>
            </div>
          </div>
          <div className={styles.drawerTabs}>
            <div className={`${styles.drawerTab} ${styles.active}`}>概览</div>
            <div className={styles.drawerTab}>证据 (5)</div>
            <div className={styles.drawerTab}>原始字段</div>
            <div className={styles.drawerTab}>历史 (3)</div>
          </div>
          <div className={styles.drawerContent}>
            
            <div className={styles.drawerPanel}>
              <div className={styles.drawerStatRow}>
                <span className={styles.drawerStatLabel}>当前结论</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={styles.tagReady}>通过</span>
                  <span style={{ fontWeight: 500 }}>可直接报名</span>
                </div>
              </div>
              <div className={styles.drawerStatRow}>
                <span className={styles.drawerStatLabel}>结论时间</span>
                <span className={styles.drawerStatValue}>2025-05-09 10:41:23</span>
              </div>
              <div className={styles.drawerStatRow}>
                <span className={styles.drawerStatLabel}>执行 Run</span>
                <span className={styles.drawerStatValue}>#20250509-1041</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <a href="#" style={{ color: 'var(--primary)' }}>查看规则</a>
                <a href="#" style={{ color: 'var(--primary)' }}>查看 Run</a>
              </div>
            </div>

            <div className={styles.drawerPanel}>
              <div className={styles.drawerPanelTitle}>影响规则 <span style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: '12px', marginLeft: '8px' }}>(已通过 28 / 共 28 条)</span></div>
              <div className={styles.drawerStatRow}>
                <span className={styles.drawerStatLabel}>规则集</span>
                <span className={styles.drawerStatValue}>v3.2.1</span>
              </div>
              <div className={styles.drawerStatRow}>
                <span className={styles.drawerStatLabel}>关键规则项</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>12 项</span>
                  <span className={styles.tagReady}>均通过</span>
                </div>
              </div>
              <div className={styles.drawerStatRow}>
                <span className={styles.drawerStatLabel}>异常规则</span>
                <span className={styles.drawerStatValue}>0 条</span>
              </div>
              <div style={{ fontSize: '13px', marginTop: '8px' }}>
                <a href="#" style={{ color: 'var(--primary)' }}>查看规则详情</a>
              </div>
            </div>

            <div className={styles.drawerPanel}>
              <div className={styles.drawerPanelTitle}>下一步建议</div>
              <div style={{ color: 'var(--ready)', fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>可直接报名</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>建议在活动报名期内正常提交报名。</div>
            </div>

            <div className={styles.drawerPanel}>
              <div className={styles.drawerPanelTitle}>证据摘要 (5)</div>
              <div className={styles.drawerEvidenceList}>
                <div className={styles.drawerEvidenceItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--ready)" /> 主图</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>1 张</span>
                    <span>合规</span>
                    <a href="#" style={{ color: 'var(--primary)' }}>查看</a>
                  </div>
                </div>
                <div className={styles.drawerEvidenceItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--ready)" /> 详情页图</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>6 张</span>
                    <span>合规</span>
                    <a href="#" style={{ color: 'var(--primary)' }}>查看</a>
                  </div>
                </div>
                <div className={styles.drawerEvidenceItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--ready)" /> 3C 证书</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>1 份</span>
                    <span>合规</span>
                    <a href="#" style={{ color: 'var(--primary)' }}>查看</a>
                  </div>
                </div>
                <div className={styles.drawerEvidenceItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--ready)" /> 包装图</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>2 张</span>
                    <span>合规</span>
                    <a href="#" style={{ color: 'var(--primary)' }}>查看</a>
                  </div>
                </div>
                <div className={styles.drawerEvidenceItem}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={14} color="var(--ready)" /> 尺码信息</div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <span>—</span>
                    <span>合规</span>
                    <a href="#" style={{ color: 'var(--primary)' }}>查看</a>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '13px', marginTop: '16px' }}>
                <a href="#" style={{ color: 'var(--primary)' }}>查看全部证据</a>
              </div>
            </div>

          </div>
          <div className={styles.drawerFooter}>
            <button className="secondaryButton">生成 Review</button>
            <button className="primaryButton" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>设置下一步 ∨</button>
          </div>
        </div>
      )}
    </div>
  )
}
