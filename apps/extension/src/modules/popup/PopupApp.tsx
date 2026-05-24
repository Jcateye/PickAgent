import { Plug, FileText, Download, CheckCircle2, RefreshCw } from 'lucide-react'
import styles from './popup.module.css'

export function PopupApp() {
  return (
    <div className={styles.layout}>
      <div className={styles.pluginContainer}>
        <div className={styles.pluginHeader}>
          <div className={styles.pluginTitle}>
            <Plug size={18} />
            SKU Ready 采集器
          </div>
          <div className={styles.statusIndicator}>
            <div className={styles.statusDot}></div>
            已连接到 Console
          </div>
        </div>

        <div className={styles.pluginBody}>
          
          <div className={styles.infoBlock}>
            <div className={styles.infoLabel}>当前页面环境</div>
            <div className={styles.infoValue}>生意参谋 - 商品分析 (List页)</div>
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>匹配到采集任务 (1)</div>
            <div className={styles.infoBlock} style={{ background: 'white', borderColor: 'var(--primary)' }}>
              <div className={styles.taskItem}>
                <FileText size={16} color="var(--primary)" style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>#task_99120</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>天猫618大促补充数据 (目标: 1258条)</div>
                </div>
              </div>
            </div>
          </div>

          <button className={styles.collectBtn}>
            <Download size={16} /> 开始采集本页数据 (100 / 1258)
          </button>

          <div className={styles.mappingBox}>
            <div className={styles.mappingHeader}>数据映射状态</div>
            <div className={styles.mappingList}>
              <div className={styles.mappingItem}>
                <span>近30天实付销量</span>
                <span className={styles.mappedKey}><CheckCircle2 size={14} /> pay_ord_itm_cnt</span>
              </div>
              <div className={styles.mappingItem}>
                <span>近30天好评率</span>
                <span className={styles.mappedKey}><CheckCircle2 size={14} /> good_review_rate</span>
              </div>
              <div className={styles.mappingItem}>
                <span>同品牌活动报名记录</span>
                <span style={{ color: 'var(--muted)' }}>当前页面未提供</span>
              </div>
            </div>
          </div>

          <div className={styles.syncStatus}>
            <RefreshCw size={14} className="animate-spin" />
            正在推送 100 条数据至 Agent...
          </div>

        </div>

        <div className={styles.pluginFooter}>
          <button className="secondaryButton" style={{ width: '100%', height: '32px' }}>断开连接</button>
        </div>
      </div>
    </div>
  )
}
