import { sidePanelData } from "../../shared/data/plugin-ui"
import { CollapsibleSection } from "../../shared/ui/CollapsibleSection"
import { ModuleCard } from "../../shared/ui/ModuleCard"
import { SecurityNote } from "../../shared/ui/SecurityNote"
import { StatusBadge } from "../../shared/ui/StatusBadge"

function toneClassName(tone: "ready" | "repair" | "review" | "risky" | "blocked") {
  return `summary-metric__value summary-metric__value--${tone}`
}

export function SidePanelApp() {
  return (
    <div className="plugin-root sidepanel-root">
      <section className="sidepanel-shell">
        <header className="sidepanel-shell__top">
          <div className="sidepanel-shell__topbar">
            <div className="sidepanel-shell__title-wrap">
              <div className="logo-badge">SR</div>
              <div>
                <h1 className="sidepanel-shell__title">{sidePanelData.pageTitle}</h1>
                <p className="sidepanel-shell__subtitle">{sidePanelData.pageSubtitle}</p>
              </div>
            </div>
            <div className="sidepanel-shell__ghost-actions">
              <button className="ghost-dark" type="button">?</button>
              <button className="ghost-dark" type="button">×</button>
            </div>
          </div>

          <div className="sidepanel-hero">
            <div className="sidepanel-hero__card">
              <div className="sidepanel-hero__eyebrow">当前页面识别</div>
              <div className="sidepanel-hero__headline">{sidePanelData.heroTitle}</div>
              <div className="sidepanel-hero__detail">{sidePanelData.heroDetail}</div>
            </div>
            <div className="sidepanel-hero__metrics">
              {sidePanelData.heroMetrics.map((metric) => (
                <div className="hero-metric" key={metric.label}>
                  <div className="hero-metric__label">{metric.label}</div>
                  <div className="hero-metric__value">{metric.value}</div>
                  <div className="hero-metric__note">{metric.note}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="sidepanel-shell__body">
          <ModuleCard title="当前页面识别结果" right={<StatusBadge tone="repair">可采集页面</StatusBadge>}>
            <div className="recognition-layout">
              <div>
                <h2 className="recognition-layout__title">{sidePanelData.recognitionTitle}</h2>
                <p className="muted-text">{sidePanelData.recognitionDescription}</p>
                <div className="recognition-layout__grid">
                  {sidePanelData.recognitionFacts.map((item) => (
                    <div className="recognition-layout__fact" key={item.label}>
                      <div className="recognition-layout__fact-label">{item.label}</div>
                      <div className="recognition-layout__fact-value">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
              <SecurityNote title={sidePanelData.boundaryTitle} text={sidePanelData.boundaryText} />
            </div>
          </ModuleCard>

          <ModuleCard title="扫描当前页面" right={<span className="muted-text">最近一次：正在运行</span>}>
            <div className="scan-card">
              <div className="scan-card__cta">
                <div>
                  <h2 className="scan-card__title">{sidePanelData.scanTitle}</h2>
                  <p className="muted-text">{sidePanelData.scanDescription}</p>
                </div>
                <button className="primary-button" type="button">开始采集</button>
              </div>
              <div>
                <div className="scan-card__progress-head">
                  <span className="scan-card__progress-label">{sidePanelData.progressLabel}</span>
                  <span className="muted-text">{sidePanelData.progressText}</span>
                </div>
                <div className="progress-bar">
                  <span style={{ width: `${sidePanelData.progressValue}%` }} />
                </div>
              </div>
            </div>
          </ModuleCard>

          <ModuleCard title="实时运行进度" right={<StatusBadge tone="repair">自动采集中</StatusBadge>}>
            <div className="timeline-card">
              <div className="timeline-card__head">
                <div>
                  <h2 className="timeline-card__title">当前采集 Run：{sidePanelData.runId}</h2>
                  <p className="muted-text">插件正在执行本页批量采集，并将在本页完成后自动翻到下一页继续循环。</p>
                </div>
                <div className="timeline-card__meta">
                  {sidePanelData.runSummary.map((item) => (
                    <span className="timeline-chip" key={item}>{item}</span>
                  ))}
                </div>
              </div>

              <div className="timeline-list">
                {sidePanelData.timeline.map((step) => (
                  <article className={`timeline-step timeline-step--${step.status}`} key={step.title}>
                    <div className="timeline-step__top">
                      <div className="timeline-step__title">{step.title}</div>
                      <div className="timeline-step__time">{step.time}</div>
                    </div>
                    <p className="muted-text">{step.description}</p>
                    {step.notes?.length ? (
                      <div className="timeline-step__notes">
                        {step.notes.map((note) => (
                          <span className="timeline-note" key={note}>{note}</span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="loop-note-row">
                <span>{sidePanelData.loopNote}</span>
                <span>{sidePanelData.nextPage}</span>
              </div>
            </div>
          </ModuleCard>

          <ModuleCard title="扫描结果摘要" right={<StatusBadge tone="review">需人工确认 1</StatusBadge>}>
            <div className="summary-grid">
              {sidePanelData.summaryMetrics.map((metric) => (
                <div className="summary-metric" key={metric.label}>
                  <div className={toneClassName(metric.tone)}>{metric.value}</div>
                  <div className="summary-metric__label">{metric.label}</div>
                </div>
              ))}
            </div>
          </ModuleCard>

          <section className="module-card">
            <CollapsibleSection title="可采集字段" meta="低频查看 · 已勾选 6 / 8">
              <div className="field-list">
                {sidePanelData.collectableFields.map((field) => (
                  <div className="field-row" key={field.title}>
                    <div className="field-row__main">
                      <div className="field-row__checkbox" />
                      <div>
                        <div className="field-row__title">{field.title}</div>
                        <div className="muted-text">{field.description}</div>
                      </div>
                    </div>
                    <span className="field-row__tag">{field.tag}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="字段映射预览" meta="按需审查 · 可追溯">
              <div className="mapping-list">
                {sidePanelData.mappingRows.map((row) => (
                  <div className="mapping-row" key={row.sourceLabel}>
                    <div>
                      <div className="mapping-row__title">{row.sourceLabel}</div>
                      <div className="mapping-row__subtle">{row.sourceArea}</div>
                    </div>
                    <div className="mapping-row__arrow">→</div>
                    <div>
                      <div className="mapping-row__title">{row.targetLabel}</div>
                      <div className="mapping-row__subtle">{row.targetPurpose}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </section>

          <ModuleCard title="风险提示" right={<span className="muted-text">均附证据来源</span>}>
            <div className="risk-list">
              {sidePanelData.risks.map((risk) => (
                <article className="risk-card" key={risk.title}>
                  <div className="risk-card__top">
                    <div className="risk-card__title">{risk.title}</div>
                    <StatusBadge tone={risk.tone}>
                      {risk.tone === "repair" ? "Repairable" : risk.tone === "review" ? "Manual Review" : risk.tone === "risky" ? "Risky" : risk.tone}
                    </StatusBadge>
                  </div>
                  <p className="muted-text">{risk.description}</p>
                  <div className="risk-card__evidence">
                    {risk.evidence.map((item) => (
                      <span className="risk-card__chip" key={item}>{item}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </ModuleCard>
        </div>

        <footer className="sticky-action-bar">
          <div className="sticky-action-bar__grid">
            <button className="secondary-button" type="button">{sidePanelData.primaryAction}</button>
            <button className="warn-button" type="button">{sidePanelData.secondaryAction}</button>
            <button className="secondary-button sticky-action-bar__full" type="button">{sidePanelData.tertiaryAction}</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
