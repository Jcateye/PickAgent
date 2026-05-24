'use client'

import React from 'react'
import { Sparkles, AlertTriangle, CheckCircle2, ChevronDown, Filter, FileText } from 'lucide-react'
import styles from './review-console.module.css'

export function ReviewConsolePage() {
  return (
    <div className={styles.layout}>
      
      {/* Left Queue */}
      <div className={styles.queueList}>
        <div className={styles.queueHeader}>
          <div className={styles.queueTitle}>待处理 (142)</div>
          <button className="iconButton"><Filter size={16} /></button>
        </div>
        <div className={styles.queueContent}>
          
          <div className={`${styles.queueItem} ${styles.active}`}>
            <div className={styles.itemHeader}>
              <span className={styles.itemTitle}>G012 - 索尼降噪耳机 XM5</span>
              <span className={styles.itemTag}>价格规则</span>
            </div>
            <div className={styles.itemDesc}>
              折扣力度 6.8% &lt; 规则要求 7% (差 0.2%)
            </div>
            <div className={styles.itemSuggestion}>
              <Sparkles size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>系统建议：建议特批通过 (历史表现优异，库存充足)</span>
            </div>
          </div>

          <div className={styles.queueItem}>
            <div className={styles.itemHeader}>
              <span className={styles.itemTitle}>D001 - 舒肤佳柠檬清香沐浴露</span>
              <span className={styles.itemTag}>功效宣称</span>
            </div>
            <div className={styles.itemDesc}>
              含有 &quot;99%抑菌&quot; 字样，需人工确认资质凭证
            </div>
            <div className={styles.itemSuggestion}>
              <AlertTriangle size={14} color="#d4a017" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>系统建议：资质缺失，建议驳回要求补充材料</span>
            </div>
          </div>

          <div className={styles.queueItem}>
            <div className={styles.itemHeader}>
              <span className={styles.itemTitle}>D045 - 欧莱雅紫熨斗眼霜</span>
              <span className={styles.itemTag}>赠品规则</span>
            </div>
            <div className={styles.itemDesc}>
              赠品价值占比疑似超过 50%
            </div>
            <div className={styles.itemSuggestion}>
              <FileText size={14} color="var(--muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>系统建议：需人工审核赠品真实价值</span>
            </div>
          </div>

        </div>
      </div>

      {/* Right Detail */}
      <div className={styles.detailArea}>
        <div className={styles.detailHeader}>
          <div className={styles.productInfo}>
            <div className={styles.productImg}></div>
            <div className={styles.productMeta}>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>索尼降噪耳机 WH-1000XM5 头戴式无线蓝牙耳机</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>SPU: 8109345123 | 类目: 3C数码 &gt; 影音电器 | 天猫618大促</div>
            </div>
          </div>
        </div>
        
        <div className={styles.detailContent}>
          
          <div className={styles.riskCard}>
            <div className={styles.riskHeader}>
              <AlertTriangle size={20} className={styles.riskIcon} />
              风险项：价格力不足
            </div>
            
            <table className={styles.dataTable}>
              <tbody>
                <tr>
                  <th>规则要求</th>
                  <td>折扣力度需 &ge; 7% (相比近30天最低价)</td>
                </tr>
                <tr>
                  <th>实际情况</th>
                  <td>折扣 6.8% (当前活动价 2199，近30天最低价 2360，相差 0.2%)</td>
                </tr>
                <tr>
                  <th>影响后果</th>
                  <td>无法入围天猫618主会场，仅可进入外场</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.agentAnalysis}>
              <div className={styles.agentHeader}>
                <Sparkles size={16} /> Agent 深度分析上下文
              </div>
              <div className={styles.agentText}>
                根据该商品的历史数据：<br/>
                1. 在去年双11大促期间，该 SPU 在对应类目下的转化率排名前 5%，属于核心引流款。<br/>
                2. 当前可售库存深度为 12,500 件，备货极其充足。<br/>
                3. 距离 7% 折扣仅差约 4 块钱，属于微小偏差。
              </div>
              <div className={styles.agentRecommend}>
                <CheckCircle2 size={16} /> 系统建议结论：特批通过
              </div>
            </div>

            <div className={styles.actionArea}>
              <div className={styles.actionTitle}>人工处理决定</div>
              <textarea 
                className={styles.actionTextarea} 
                placeholder="输入审批意见或备注..."
                defaultValue="同意 Agent 建议，该商品为核心爆款，微小价格偏差特批通过。"
              ></textarea>
              <div className={styles.actionButtons}>
                <button className="primaryButton" style={{ height: '36px', padding: '0 24px' }}>特批通过</button>
                <button className="secondaryButton" style={{ height: '36px' }}>要求修改价格</button>
                <button className={styles.btnReject}>驳回</button>
                <div style={{ flex: 1 }}></div>
                <button className="secondaryButton" style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  下一个 <ChevronDown size={16} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
