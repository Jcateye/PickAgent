import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel, TwoColumnScaffold } from '@/shared/ui/page-scaffolds'

export function ConnectorsPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="Connectors"
        description="展示平台连接、插件采集边界和接入说明。当前仅实现页面结构，不展示真实连接状态。"
      />
      <TwoColumnScaffold
        main={<SummaryPanel title="平台连接概览" description="连接摘要和接入状态待后端接口就绪后接入。" state="unavailable" />}
        side={<SummaryPanel title="插件采集安全说明" description="安全边界和字段范围说明容器已预留。" />}
      />
    </div>
  )
}
