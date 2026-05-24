'use client'

import React from 'react'
import { RotateCcw, Download, ExternalLink } from 'lucide-react'
import styles from './run-console.module.css'

export function RunConsolePage() {
  return (
    <div className={styles.layout}>
      
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Run History</div>
          <select style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid var(--line)', padding: '0 8px', fontSize: '13px' }}>
            <option>活动：天猫618大促</option>
          </select>
        </div>
        <div className={styles.runList}>
          <div className={`${styles.runItem} ${styles.active}`}>
            <div className={styles.runIdRow}>
              <span>#20250509-1041</span>
              <span className={styles.statusSuccess}>Success</span>
            </div>
            <div className={styles.runMetaRow}>
              <span>Today 10:41</span>
              <span>1m 23s</span>
            </div>
          </div>
          <div className={styles.runItem}>
            <div className={styles.runIdRow}>
              <span>#20250509-0912</span>
              <span className={styles.statusFailed}>Failed</span>
            </div>
            <div className={styles.runMetaRow}>
              <span>Today 09:12</span>
              <span>45s</span>
            </div>
          </div>
          <div className={styles.runItem}>
            <div className={styles.runIdRow}>
              <span>#20250508-1830</span>
              <span className={styles.statusSuccess}>Success</span>
            </div>
            <div className={styles.runMetaRow}>
              <span>Yesterday 18:30</span>
              <span>1m 15s</span>
            </div>
          </div>
          <div className={styles.runItem}>
            <div className={styles.runIdRow}>
              <span>#20250507-1000</span>
              <span className={styles.statusSuccess}>Success</span>
            </div>
            <div className={styles.runMetaRow}>
              <span>May 07 10:00</span>
              <span>1m 30s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className={styles.mainArea}>
        <div className={styles.mainHeader}>
          <div className={styles.runTitleInfo}>
            <div className={styles.runTitle}>Run #20250509-1041</div>
            <div className={styles.runBadges}>
              <span className={`${styles.badge} ${styles.badgeSuccess}`}>状态: 成功</span>
              <span className={styles.badge}>来源: Agent 触发</span>
              <span className={styles.badge}>耗时: 1m 23s</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}><RotateCcw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>重试失败项</button>
            <button className="secondaryButton" style={{ height: '32px', fontSize: '13px' }}><Download size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>导出日志</button>
            <button className="iconButton" style={{ height: '32px', width: '32px' }}><ExternalLink size={16} /></button>
          </div>
        </div>

        <div className={styles.tabsBar}>
          <div className={`${styles.tab} ${styles.active}`}>Timeline</div>
          <div className={styles.tab}>Raw Logs</div>
          <div className={styles.tab}>Plugin Traces</div>
        </div>

        <div className={styles.terminalContainer}>
          <div className={styles.terminalBox}>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:00.000]</span>
              <span className={`${styles.logTag} ${styles.logTagSystem}`}>[System]</span>
              <span className={styles.logContent}>Initialize Run for activity &apos;天猫618大促&apos;, fetching configuration...</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:00.120]</span>
              <span className={`${styles.logTag} ${styles.logTagSystem}`}>[System]</span>
              <span className={styles.logContent}>Loaded 28 rules. Target SKU count: 1258.</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:02.045]</span>
              <span className={`${styles.logTag} ${styles.logTagData}`}>[Data]</span>
              <span className={styles.logContent}>检查本地缓存数据新鲜度... <span className={styles.logSuccess}>(OK)</span> 98% data within 1 hour freshness.</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:03.500]</span>
              <span className={`${styles.logTag} ${styles.logTagData}`}>[Data]</span>
              <span className={styles.logContent}>Identified 2 missing fields: &apos;可售库存&apos;, &apos;同品牌活动报名记录&apos;.</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:05.112]</span>
              <span className={`${styles.logTag} ${styles.logTagPlugin}`}>[Plugin]</span>
              <span className={styles.logContent}>触发浏览器插件数据采集任务... Dispatching to connected extension client (ID: ext_8a9b2c).</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}></span>
              <span className={styles.logTag}></span>
              <div className={styles.logContent}>
                <pre className={styles.jsonPayload}>
{`{
  "taskId": "task_99120",
  "action": "scrape_inventory_and_events",
  "urls": [
    "https://inventory.tmall.com/query?skuId=...",
    "https://campaign.tmall.com/history?brandId=..."
  ],
  "timeout": 30000
}`}
                </pre>
              </div>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:40.800]</span>
              <span className={`${styles.logTag} ${styles.logTagPlugin}`}>[Plugin]</span>
              <span className={styles.logContent}>Extension response received. <span className={styles.logSuccess}>Status: 200 OK.</span> Extracted 1258 inventory records, 52 event records.</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:41:45.000]</span>
              <span className={`${styles.logTag} ${styles.logTagAgent}`}>[Agent]</span>
              <span className={styles.logContent}>接收到插件返回数据，开始诊断 SKU 规则... (Batch size: 100)</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:42:01.300]</span>
              <span className={`${styles.logTag} ${styles.logTagAgent}`}>[Agent]</span>
              <span className={styles.logContent}>Processing batch 12/13...</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:42:23.150]</span>
              <span className={`${styles.logTag} ${styles.logTagSystem}`}>[System]</span>
              <span className={styles.logContent}>诊断完成。1258 SKUs processed. <span className={styles.logSuccess}>862 Passed</span>, 246 Repairable, <span style={{color: '#ff8b00'}}>142 Needs Review</span>, <span className={styles.logError}>8 Rejected</span>.</span>
            </div>
            <div className={styles.logLine}>
              <span className={styles.logTime}>[10:42:23.200]</span>
              <span className={`${styles.logTag} ${styles.logTagSystem}`}>[System]</span>
              <span className={styles.logContent}>Run finished successfully. Closing trace.</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
