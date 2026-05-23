import Link from 'next/link'

import { healthStatusTone } from '@/modules/staff-health-console/contracts'
import { getSkuDetail, getSkuList } from '@/modules/staff-health-console/data'
import { PageHeader } from '@/shared/ui/page-header'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { StatusBadge } from '@/shared/ui/status-badge'

export async function SkuHealthPage({ skuProfileId }: { skuProfileId?: string }) {
  const skuList = await getSkuList()
  const selectedSku = await getSkuDetail(skuProfileId ?? skuList[0]?.skuProfileId)

  return (
    <div className="pageStack">
      <PageHeader
        title="SKU 健康"
        description="SKU 列表和详情只展示 CurrentSkuProjection 与 SKU detail DTO，状态、分数、问题和下一步动作均不在前端重新计算。"
      />

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
                {skuList.map((sku) => (
                  <Link
                    className="skuTableRow skuTableRow--link"
                    href={sku.targetHref}
                    key={sku.skuProfileId}
                    aria-current={sku.skuProfileId === selectedSku.projection.skuProfileId ? 'page' : undefined}
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
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="twoColumnSide">
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

          <Panel>
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
          </Panel>

          <Panel>
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
          </Panel>
        </div>
      </div>
    </div>
  )
}
