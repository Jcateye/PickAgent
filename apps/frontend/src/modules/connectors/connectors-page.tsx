import Link from 'next/link'

import { ApiStatePanel } from '@/modules/staff-health-console/api-state-panel'
import { connectorStatusTone } from '@/modules/staff-health-console/contracts'
import { getConnectorConsole } from '@/modules/staff-health-console/data'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

export async function ConnectorsPage() {
  const consoleState = await getConnectorConsole()

  return (
    <div className="pageStack">
      <PageHeader
        title="Connectors"
        description="展示插件或连接器的连接状态、最近一次采集摘要和当前可用边界；本页不承担插件自动化控制流程。"
      />
      {consoleState.viewState ? <ApiStatePanel state={consoleState.viewState} /> : null}

      <div className="twoColumnScaffold">
        <div className="twoColumnMain">
          <Panel>
            <PanelHeader title="平台连接概览" description="连接状态和最近采集摘要来自 connector DTO。" />
            <PanelBody>
              <div className="connectorList">
                {consoleState.connectors.map((connector) => (
                  <Link className="connectorItem" href={connector.targetHref} key={connector.id}>
                    <div className="connectorTitleRow">
                      <div>
                        <strong>{connector.name}</strong>
                        <span>{connector.platform}</span>
                      </div>
                      <StatusBadge tone={connectorStatusTone(connector.status)}>{connector.status}</StatusBadge>
                    </div>
                    <dl>
                      <div>
                        <dt>最近采集</dt>
                        <dd>{connector.lastIngestedAtLabel}</dd>
                      </div>
                      <div>
                        <dt>摘要</dt>
                        <dd>{connector.lastIngestSummary}</dd>
                      </div>
                    </dl>
                    <p>{connector.capabilityBoundary}</p>
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="twoColumnSide">
          <Panel>
            <PanelHeader title="采集边界" description="边界说明冻结为前端 contract，避免页面越权控制插件或重算健康结论。" />
            <PanelBody>
              <ul className="boundaryList">
                {consoleState.collectionBoundaries.map((boundary) => (
                  <li key={boundary.id}>
                    <strong>{boundary.label}</strong>
                    <p>{boundary.description}</p>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
