'use client'

import React from 'react'
import { Bot, User, Wrench, CheckCircle2, ArrowRight, ArrowUp, Zap } from 'lucide-react'
import styles from './agent-mission.module.css'
import Link from 'next/link'

export function AgentMissionPage() {
  return (
    <div className={styles.layout}>
      
      <div className={styles.missionHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Mission: 执行天猫618选品规则检查</h1>
          <span className="statusBadge statusBadge--ready" style={{ fontSize: '11px' }}>Active</span>
        </div>
        <div>
          <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}>查看完整 Mission</button>
        </div>
      </div>

      <div className={styles.chatArea}>
        
        <div className={`${styles.messageRow} ${styles.user}`}>
          <div className={`${styles.avatar} ${styles.avatarUser}`}><User size={18} /></div>
          <div className={styles.messageContent}>
            <div className={styles.messageBubble}>
              帮我执行一遍最新的天猫618选品规则检查。
            </div>
          </div>
        </div>

        <div className={`${styles.messageRow} ${styles.agent}`}>
          <div className={`${styles.avatar} ${styles.avatarAgent}`}><Bot size={18} /></div>
          <div className={styles.messageContent}>
            <div className={styles.messageBubble}>
              好的。我将为您执行「天猫618选品规则检查」。<br/><br/>
              **执行计划如下：**<br/>
              1. 获取最新的天猫618规则版本。<br/>
              2. 检查本地数据缓存新鲜度。<br/>
              3. 调度浏览器插件补充缺失的外部数据（库存、互斥活动记录）。<br/>
              4. 运行诊断引擎。<br/>
              <br/>
              我现在开始执行。
            </div>
          </div>
        </div>

        <div className={`${styles.messageRow} ${styles.agent}`}>
          <div className={`${styles.avatar} ${styles.avatarAgent}`} style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)' }}><Zap size={18} /></div>
          <div className={styles.messageContent}>
            
            <div className={styles.toolCallBlock}>
              <div className={styles.toolHeader}>
                <Wrench size={14} className={styles.toolIcon} />
                <span>Tool Call: fetch_activity_rules</span>
              </div>
              <div className={styles.toolResult}>
                ✓ Loaded rule set v3.2.1 (28 items)
              </div>
            </div>

            <div className={styles.toolCallBlock}>
              <div className={styles.toolHeader}>
                <Wrench size={14} className={styles.toolIcon} />
                <span>Tool Call: check_data_freshness</span>
              </div>
              <div className={styles.toolResult}>
                ✓ Identified 2 missing data sources requiring plugin trigger.
              </div>
            </div>

            <div className={styles.toolCallBlock}>
              <div className={styles.toolHeader}>
                <Wrench size={14} className={styles.toolIcon} />
                <span>Tool Call: trigger_plugin_collection</span>
              </div>
              <div className={styles.toolResult}>
                ✓ Plugin trace #20250509-1041 started. Waiting for response...<br/>
                ✓ Received 1258 inventory records.
              </div>
            </div>

          </div>
        </div>

        <div className={`${styles.messageRow} ${styles.agent}`}>
          <div className={`${styles.avatar} ${styles.avatarAgent}`}><Bot size={18} /></div>
          <div className={styles.messageContent}>
            <div className={styles.messageBubble}>
              诊断完成。共处理 1,258 个 SKU。<br/>
              其中 862 个 SKU 符合要求可直接报名，246 个可以修复。<br/>
              **发现 142 个 SKU 需要人工确认（主要是价格门槛和历史功效凭证问题）。**<br/>
              <br/>
              我已经为您生成了 Review 工作台，请点击下方卡片进入人工审批流：
            </div>

            <div className={styles.reviewWidget}>
              <div className={styles.reviewWidgetHeader}>
                <CheckCircle2 size={16} color="#ff8b00" />
                人工确认门 - 天猫618大促 (142 项待审)
              </div>
              <div className={styles.reviewWidgetDesc}>
                系统已自动拦截 142 项高风险 / 不确定项，需运营人工干预。
              </div>
              <Link href="/review-console">
                <button className="primaryButton" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ff8b00' }}>
                  进入 Review 工作台 <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            
          </div>
        </div>

      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputBox}>
          <textarea 
            className={styles.chatTextarea} 
            placeholder="Reply to SKU Ready Agent..." 
            rows={1}
          ></textarea>
          <button className={styles.sendBtn}>
            <ArrowUp size={16} />
          </button>
        </div>
      </div>

    </div>
  )
}
