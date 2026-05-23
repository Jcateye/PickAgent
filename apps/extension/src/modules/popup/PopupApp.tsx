import { popupData } from "../../shared/data/plugin-ui"
import { KeyFactCard } from "../../shared/ui/KeyFactCard"
import { SecurityNote } from "../../shared/ui/SecurityNote"
import { StatusBadge } from "../../shared/ui/StatusBadge"

export function PopupApp() {
  return (
    <div className="plugin-root popup-root">
      <section className="popup-card">
        <header className="popup-card__top">
          <div className="popup-card__brand">
            <div className="popup-card__brand-left">
              <div className="logo-badge">SR</div>
              <div>
                <h1 className="popup-card__title">SKU Ready Agent</h1>
                <p className="popup-card__subtitle">浏览器插件 · 当前页面就绪</p>
              </div>
            </div>
            <span className="dark-pill">已连接</span>
          </div>
          <div className="popup-card__mini-grid">
            <div className="popup-card__mini-panel">
              <div className="popup-card__mini-label">平台识别</div>
              <div className="popup-card__mini-value">{popupData.platform}</div>
            </div>
            <div className="popup-card__mini-panel">
              <div className="popup-card__mini-label">店铺</div>
              <div className="popup-card__mini-value">{popupData.store}</div>
            </div>
          </div>
        </header>

        <div className="popup-card__body">
          <div className="popup-status-card">
            <div className="popup-status-card__row">
              <div className="popup-status-card__status-line">
                <StatusBadge tone={popupData.pageStatusTone}>{popupData.pageStatusLabel}</StatusBadge>
                <strong className="popup-status-card__headline">{popupData.pageStatusText}</strong>
              </div>
              <span className="muted-text">{popupData.confidence}</span>
            </div>

            <div className="info-grid info-grid--two">
              {popupData.keyFacts.map((item) => (
                <KeyFactCard key={item.label} label={item.label} value={item.value} />
              ))}
            </div>

            <SecurityNote title={popupData.securityTitle} text={popupData.securityText} />

            <div className="popup-card__actions">
              <button className="primary-button" type="button">
                {popupData.primaryAction}
              </button>
              <button className="secondary-button" type="button">
                {popupData.secondaryAction}
              </button>
            </div>
          </div>

          <footer className="popup-card__footer">
            <span>{popupData.recentRunLabel}</span>
            <span>{popupData.version}</span>
          </footer>
        </div>
      </section>
    </div>
  )
}
