'use client'

import { useState } from 'react'

import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

import type { ReportOutputStatus } from './report-contracts'
import { createReportProviderSnapshot } from './report-service-provider'

const outputStatusLabel: Record<ReportOutputStatus, string> = {
  preview_ready: '预览就绪',
  export_placeholder: '导出占位',
  export_requested: '已请求导出'
}

function outputStatusTone(status: ReportOutputStatus) {
  if (status === 'preview_ready') return 'ready'
  if (status === 'export_requested') return 'warning'
  return 'neutral'
}

export function ReportsPage() {
  const [{ preview, mode, fallbackReason }] = useState(() => createReportProviderSnapshot())
  const [outputStatus, setOutputStatus] = useState<ReportOutputStatus>(preview.outputStatus)
  const unresolvedRiskSection = preview.sections.find((section) => section.id === 'unresolved_risks')

  return (
    <div className="pageStack">
      <WorkbenchContextRegistration
        context={{
          route: '/reports',
          pageTitle: '报告页',
          selectedEntity: {
            entityType: 'report',
            entityId: preview.id,
            label: preview.title,
          },
          visibleFilters: { reportType: preview.type, outputStatus },
          visibleColumns: ['section', 'summary', 'evidence', 'unresolvedRisk'],
        }}
      />
      <PageHeader
        title="报告页"
        description={`消费 ReportService DTO 展示报告章节、摘要、输出状态、evidence summary 和未解决风险。当前数据源：${mode === 'service' ? 'ReportService' : 'mock fallback'}`}
      />

      <div className="reportPreviewLayout">
        <Panel>
          <PanelHeader
            title={preview.title}
            description={`${preview.id} · ${preview.generatedAt}`}
            actions={<StatusBadge tone={outputStatusTone(outputStatus)}>{outputStatusLabel[outputStatus]}</StatusBadge>}
          />
          <PanelBody className="reportBody">
            <section className="reportExecutiveSummary">
              <span>摘要</span>
              <p>{preview.executiveSummary}</p>
            </section>

            <div className="reportSectionList">
              {preview.sections.map((section) => (
                <section className="reportSection" key={section.id}>
                  <div className="reportSectionHeader">
                    <span>{section.id}</span>
                    <h3>{section.title}</h3>
                    <p>{section.summary}</p>
                  </div>
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  <div className="evidenceList">
                    {section.evidenceSummary.map((evidence) => (
                      <div className="evidenceRow" key={evidence.id}>
                        <span>{evidence.label}</span>
                        <strong>{evidence.value}</strong>
                        <code>{evidence.source}</code>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </PanelBody>
        </Panel>

        <div className="pageStack">
          <Panel>
            <PanelHeader title="报告输出" description="首版不完成真实导出，只反馈导出占位和动作状态。" />
            <PanelBody className="reportActionBody">
              <div className="detailBlock">
                <span>来源对象</span>
                <strong>{preview.sourceObject.title}</strong>
                <p>
                  {preview.sourceObject.type} · {preview.sourceObject.id}
                </p>
              </div>
              <button className="primaryButton" type="button" onClick={() => setOutputStatus('export_requested')}>
                请求导出
              </button>
              <button className="secondaryButton" type="button" onClick={() => setOutputStatus('export_placeholder')}>
                标记导出占位
              </button>
              <p className="mutedText">真实导出仍是占位；预览内容来自 ReportService，未复制生产凭据或外部接口数据。</p>
              {fallbackReason ? <p className="mutedText">Fallback：{fallbackReason}</p> : null}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Evidence Summary" description="报告级 evidence summary，直接来自服务端 Report DTO。" />
            <PanelBody>
              <div className="evidenceList">
                {preview.evidenceSummary.map((evidence) => (
                  <div className="evidenceRow" key={evidence.id}>
                    <span>{evidence.label}</span>
                    <strong>{evidence.value}</strong>
                    <code>{evidence.source}</code>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="未解决风险" description="报告必须显式展示仍需处理或人工确认的风险。" />
            <PanelBody>
              <p className="mutedText">{unresolvedRiskSection?.summary ?? '当前报告没有未解决风险。'}</p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="输出状态 Contract" description="报告类型、章节结构、摘要内容、输出状态与 evidence summary。" />
            <PanelBody>
              <div className="contractList">
                <div>
                  <span>reportType</span>
                  <strong>{preview.type}</strong>
                </div>
                <div>
                  <span>outputStatus</span>
                  <strong>{outputStatus}</strong>
                </div>
                <div>
                  <span>sections</span>
                  <strong>{preview.sections.length} 个章节</strong>
                </div>
                <div>
                  <span>evidenceSummary</span>
                  <strong>{preview.evidenceSummary.length} 条</strong>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
