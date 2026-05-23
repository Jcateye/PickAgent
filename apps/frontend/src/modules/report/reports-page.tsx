'use client'

import { useState } from 'react'

import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

import type { ReportOutputStatus } from './report-contracts'
import { mockReportPreview } from './report-fixtures'

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
  const [outputStatus, setOutputStatus] = useState<ReportOutputStatus>(mockReportPreview.outputStatus)

  return (
    <div className="pageStack">
      <PageHeader
        title="报告页"
        description="消费 Report DTO 展示报告章节、摘要、输出状态和 evidence summary；导出首版只保留动作状态。"
      />

      <div className="reportPreviewLayout">
        <Panel>
          <PanelHeader
            title={mockReportPreview.title}
            description={`${mockReportPreview.id} · ${mockReportPreview.generatedAt}`}
            actions={<StatusBadge tone={outputStatusTone(outputStatus)}>{outputStatusLabel[outputStatus]}</StatusBadge>}
          />
          <PanelBody className="reportBody">
            <section className="reportExecutiveSummary">
              <span>摘要</span>
              <p>{mockReportPreview.executiveSummary}</p>
            </section>

            <div className="reportSectionList">
              {mockReportPreview.sections.map((section) => (
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
                <strong>{mockReportPreview.sourceObject.title}</strong>
                <p>
                  {mockReportPreview.sourceObject.type} · {mockReportPreview.sourceObject.id}
                </p>
              </div>
              <button className="primaryButton" type="button" onClick={() => setOutputStatus('export_requested')}>
                请求导出
              </button>
              <button className="secondaryButton" type="button" onClick={() => setOutputStatus('export_placeholder')}>
                标记导出占位
              </button>
              <p className="mutedText">真实导出与正式报告验收等待 ReportService 完成后接入。</p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="输出状态 Contract" description="报告类型、章节结构、摘要内容、输出状态与 evidence summary。" />
            <PanelBody>
              <div className="contractList">
                <div>
                  <span>reportType</span>
                  <strong>{mockReportPreview.type}</strong>
                </div>
                <div>
                  <span>outputStatus</span>
                  <strong>{outputStatus}</strong>
                </div>
                <div>
                  <span>sections</span>
                  <strong>{mockReportPreview.sections.length} 个章节</strong>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
