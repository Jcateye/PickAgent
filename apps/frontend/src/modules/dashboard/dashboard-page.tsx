import Link from 'next/link'

import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import { getDashboardSummary } from '@/modules/staff-health-console/data'
import { workflowRunTone } from '@/modules/staff-health-console/contracts'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

export async function DashboardPage() {
  const summary = await getDashboardSummary()

  return (
    <div className="pageStack">
      <WorkbenchContextRegistration
        context={{
          route: '/dashboard',
          pageTitle: 'Dashboard 总览',
          selectedEntity: { entityType: 'dashboard', entityId: 'dashboard', label: 'Dashboard 总览' },
          visibleFilters: { scope: 'all-platforms', health: 'summary' },
          visibleColumns: ['risk', 'count', 'nextAction', 'latestRun'],
        }}
      />
      <PageHeader
        title="Dashboard 总览"
        description="总览页展示监控范围、健康状态分布、数据质量摘要和最近运行入口；页面只消费 summary DTO，不展开活动模拟或审批细节。"
      />

      <section className="kpiGrid">
        {summary.metrics.map((metric) => (
          <Panel key={metric.id}>
            <PanelBody>
              <div className="metricCard">
                <div>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
                <StatusBadge tone={metric.tone}>{metric.label}</StatusBadge>
                <p>{metric.description}</p>
              </div>
            </PanelBody>
          </Panel>
        ))}
      </section>

      <div className="twoColumnScaffold">
        <div className="twoColumnMain">
          <Panel>
            <PanelHeader title="风险摘要" description="风险聚合来自服务端 summary DTO，点击进入对象列表继续处理。" />
            <PanelBody>
              <div className="riskSummaryList">
                {summary.riskSummaries.map((risk) => (
                  <Link className="summaryLinkItem" href={risk.targetHref} key={risk.id}>
                    <div>
                      <StatusBadge tone={risk.tone}>{risk.count}</StatusBadge>
                      <strong>{risk.label}</strong>
                      <p>{risk.description}</p>
                    </div>
                    <span>查看 SKU</span>
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="twoColumnSide">
          <Panel>
            <PanelHeader title="最近运行摘要" description="最近采集与刷新运行入口保持和 Workflow 页面一致的对象语义。" />
            <PanelBody>
              <div className="runList">
                {summary.recentRuns.map((run) => (
                  <Link className="runItem" href={run.targetHref} key={run.id}>
                    <div className="runTitleRow">
                      <strong>{run.title}</strong>
                      <StatusBadge tone={workflowRunTone(run.status)}>{run.status}</StatusBadge>
                    </div>
                    <dl>
                      <div>
                        <dt>来源</dt>
                        <dd>{run.source}</dd>
                      </div>
                      <div>
                        <dt>时间</dt>
                        <dd>{run.finishedAtLabel}</dd>
                      </div>
                    </dl>
                    <p>{run.summary}</p>
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="快捷入口" description="只提供导航入口，不把活动模拟或 Review 操作平铺到 Dashboard。" />
            <PanelBody>
              <div className="quickLinkList">
                {summary.primaryLinks.map((link) => (
                  <Link className="quickLinkItem" href={link.href} key={link.href}>
                    <strong>{link.label}</strong>
                    <span>{link.description}</span>
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
