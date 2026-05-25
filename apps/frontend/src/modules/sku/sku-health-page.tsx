import Link from 'next/link'

import { WorkbenchContextRegistration } from '@/modules/agent-copilot/workbench-context'
import { ApiStatePanel } from '@/modules/staff-health-console/api-state-panel'
import { healthStatusTone } from '@/modules/staff-health-console/contracts'
import { getSkuDetail, getSkuList } from '@/modules/staff-health-console/data'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

export async function SkuHealthPage({ skuProfileId }: { skuProfileId?: string }) {
  const skuList = await getSkuList()
  const selectedSku = await getSkuDetail(skuProfileId ?? skuList.items[0]?.skuProfileId)
  const selectedProjection = selectedSku?.projection ?? skuList.items[0]

  return (
    <div className="pageStack">
      {selectedProjection ? (
        <WorkbenchContextRegistration
          context={{
            route: selectedProjection.targetHref ?? '/sku-health',
            pageTitle: 'SKU 健康',
            selectedEntity: {
              entityType: 'sku',
              entityId: selectedProjection.skuProfileId,
              label: selectedProjection.productName,
            },
            visibleFilters: { platform: selectedProjection.platform, healthStatus: selectedProjection.healthStatus },
            visibleColumns: ['sku', 'platform', 'health', 'quality', 'nextAction'],
          }}
        />
      ) : null}
      <PageHeader
        title="SKU 健康"
        description="SKU 列表和详情只展示 CurrentSkuProjection 与 SKU detail DTO，状态、分数、问题和下一步动作均不在前端重新计算。"
      />
      <ApiStatePanel state={selectedSku?.viewState ?? skuList.viewState} />

      <div className="twoColumnScaffold skuHealthLayout">
        <div className="twoColumnMain">
          <Panel>
            <PanelHeader title="SKU 列表" description="从服务端 projection contract 渲染状态标记、分数、问题摘要和对象入口。" />
            <PanelBody>
              <div className="skuTable">
                <div className="skuTableRow skuTableRow--head">
                  <span>SKU</span>
                  <span>平台</span>
                  <span>健康</span>
                  <span>质量</span>
                  <span>下一步</span>
                </div>
                {skuList.items.length === 0 ? (
                  <div className="skuTableEmpty">真实 SKU list 当前为空；请先通过 /api/ingest 写入采集结果。</div>
                ) : (
                  skuList.items.map((sku) => (
                    <Link
                      className="skuTableRow skuTableRow--link"
                      href={sku.targetHref}
                      key={sku.skuProfileId}
                      aria-current={sku.skuProfileId === selectedProjection?.skuProfileId ? 'page' : undefined}
                    >
                      <span>
                        <strong>{sku.productName}</strong>
                        <small>{sku.canonicalSkuKey}</small>
                      </span>
                      <span>
                        {sku.platform}
                        <small>{sku.storeName}</small>
                      </span>
                      <span>
                        <StatusBadge tone={healthStatusTone(sku.healthStatus)}>{sku.healthStatus}</StatusBadge>
                        <small>{sku.healthScore} 分</small>
                      </span>
                      <span>{sku.dataQualityScore}%</span>
                      <span>{sku.nextAction}</span>
                    </Link>
                  ))
                )}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="twoColumnSide">
          {!selectedSku ? (
            <Panel>
              <PanelHeader title="SKU 详情" description="没有真实 SKU detail DTO 时不展示示例业务数据。" />
              <PanelBody>
                <div className="compactState">当前没有可展示的真实 SKU 详情。请先通过数据源同步或 SKU API 写入 projection。</div>
              </PanelBody>
            </Panel>
          ) : (
            <>
          <Panel>
            <PanelHeader
              title="SKU 详情"
              description="详情页第一屏只呈现状态、问题摘要、证据摘要和下一步动作。"
            />
            <PanelBody>
              <div className="skuDetailHeader">
                <div>
                  <strong>{selectedSku.projection.productName}</strong>
                  <p>{selectedSku.projection.canonicalSkuKey}</p>
                </div>
                <StatusBadge tone={healthStatusTone(selectedSku.projection.healthStatus)}>
                  {selectedSku.projection.healthStatus}
                </StatusBadge>
              </div>
              <div className="scoreGrid">
                <div>
                  <span>健康分</span>
                  <strong>{selectedSku.projection.healthScore}</strong>
                </div>
                <div>
                  <span>数据质量</span>
                  <strong>{selectedSku.projection.dataQualityScore}%</strong>
                </div>
                <div>
                  <span>最近刷新</span>
                  <strong>{selectedSku.projection.updatedAtLabel}</strong>
                </div>
              </div>
              <div className="detailSummaryBlock">
                <span>问题摘要</span>
                <p>{selectedSku.projection.issueSummary}</p>
              </div>
              <div className="detailSummaryBlock">
                <span>下一步动作</span>
                <p>{selectedSku.projection.nextAction}</p>
              </div>
            </PanelBody>
          </Panel>
            </>
          )}

          {selectedSku ? <Panel>
            <PanelHeader title="问题与动作" description="问题严重性和 owner 均来自 SKU detail DTO。" />
            <PanelBody>
              <div className="issueList">
                {selectedSku.issues.length === 0 ? (
                  <div className="compactState">当前 DTO 未返回阻断问题。</div>
                ) : (
                  selectedSku.issues.map((issue) => (
                    <div className="issueItem" key={issue.id}>
                      <StatusBadge tone={issue.severity}>{issue.title}</StatusBadge>
                      <p>{issue.summary}</p>
                    </div>
                  ))
                )}
              </div>
              <ol className="nextActionList">
                {selectedSku.nextActions.map((action, index) => (
                  <li key={action.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{action.title}</strong>
                      <p>
                        {action.description} Owner: {action.owner}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </PanelBody>
          </Panel> : null}

          {selectedSku ? <Panel>
            <PanelHeader title="证据摘要" description="只展示 detail DTO 给出的字段来源，不在页面拼装 snapshot。" />
            <PanelBody>
              <div className="evidenceList">
                {selectedSku.evidence.map((evidence) => (
                  <div className="evidenceItem" key={evidence.id}>
                    <span>{evidence.label}</span>
                    <strong>{evidence.value}</strong>
                    <small>{evidence.source}</small>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel> : null}

          {selectedSku ? <Panel>
            <PanelHeader title="可追溯来源" description="snapshot、diagnosis、collection risk 和 evidence source 均来自 SKU detail DTO。" />
            <PanelBody>
              <div className="traceabilityList">
                <div>
                  <span>Snapshot</span>
                  <strong>{selectedSku.traceability?.snapshot?.id ?? '未返回'}</strong>
                  <p>{selectedSku.traceability?.snapshot?.summary ?? '真实 detail DTO 未返回 latestSnapshot。'}</p>
                </div>
                <div>
                  <span>Diagnosis</span>
                  <strong>{selectedSku.traceability?.diagnosis?.id ?? '未返回'}</strong>
                  <p>{selectedSku.traceability?.diagnosis?.summary ?? '真实 detail DTO 未返回 latestDiagnosis。'}</p>
                </div>
                <div>
                  <span>Collection Risk</span>
                  <strong>{selectedSku.traceability?.collectionRisks.length ?? 0} 项</strong>
                  <p>{selectedSku.traceability?.collectionRisks.join('；') || '当前 DTO 未返回采集缺口风险。'}</p>
                </div>
                <div>
                  <span>Evidence Source</span>
                  <strong>{selectedSku.traceability?.evidenceSources.length ?? selectedSku.evidence.length} 项</strong>
                  <p>{selectedSku.traceability?.evidenceSources.join('；') || selectedSku.evidence.map((item) => `${item.label}: ${item.source}`).join('；')}</p>
                </div>
              </div>
            </PanelBody>
          </Panel> : null}
        </div>
      </div>
    </div>
  )
}
