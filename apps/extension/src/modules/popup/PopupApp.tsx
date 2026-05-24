import { ExternalLink, PanelRightOpen, Plug } from 'lucide-react'
import styles from './popup.module.css'

export function PopupApp() {
  const openSidePanel = async () => {
    const chromeApi = (globalThis as typeof globalThis & { chrome?: unknown }).chrome as
      | {
          tabs?: { query?: (queryInfo: { active: boolean; currentWindow: boolean }, callback: (tabs: Array<{ id?: number }>) => void) => void }
          sidePanel?: { open?: (options: { tabId?: number }) => Promise<void> }
        }
      | undefined

    chromeApi?.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
      void chromeApi.sidePanel?.open?.({ tabId: tabs[0]?.id })
    })
  }

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
            localhost:3010
          </div>
        </div>

        <div className={styles.pluginBody}>
          <div className={styles.infoBlock}>
            <div className={styles.infoLabel}>真实提交通路</div>
            <div className={styles.infoValue}>http://localhost:3010/api/ingest</div>
          </div>

          <div className={styles.infoBlock}>
            <div className={styles.infoLabel}>采集入口</div>
            <div className={styles.infoValue}>在侧边栏执行抖店库存真实采集、预览和提交。</div>
          </div>

          <button className={styles.collectBtn} type="button" onClick={() => void openSidePanel()}>
            <PanelRightOpen size={16} /> 打开采集侧边栏
          </button>

          <a className={styles.consoleLink} href="http://localhost:3010/sku-health" target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> 打开 SKU 健康页
          </a>
        </div>
      </div>
    </div>
  )
}
