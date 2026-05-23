import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel, TableShellPanel, TwoColumnScaffold } from '@/shared/ui/page-scaffolds'

export function SkuHealthPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="SKU 健康"
        description="该页保留左侧列表、右侧详情的任务型布局。真实列表和详情数据待后端接口接入。"
      />
      <TwoColumnScaffold
        main={<TableShellPanel title="SKU 列表" description="支持筛选、排序、搜索和分页的列表结构已准备完成。" columns={7} />}
        side={
          <div className="pageStack">
            <SummaryPanel title="SKU 详情" description="请在接口接入后展示聚合详情 DTO。当前保留详情容器与占位结构。" />
            <SummaryPanel title="Issues / Next Actions" description="下一步动作与问题摘要将在这里展示。" state="unavailable" />
            <SummaryPanel title="Evidence Timeline" description="证据时间线保留为单独信息层。" state="unavailable" />
          </div>
        }
      />
    </div>
  )
}
