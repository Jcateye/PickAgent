import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel, TwoColumnScaffold } from '@/shared/ui/page-scaffolds'

export function ReportsPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="报告页"
        description="左侧是报告预览容器，右侧是报告操作和证据关联摘要。本次仅实现无数据态结构。"
      />
      <TwoColumnScaffold
        main={<SummaryPanel title="报告预览" description="报告正文区域在接口接入前保持空态或不可用态。" />}
        side={
          <div className="pageStack">
            <SummaryPanel title="报告操作" description="复制摘要、生成报告、导出动作位已保留。" state="unavailable" />
            <SummaryPanel title="证据关联" description="证据链摘要和跳转入口位已预留。" state="unavailable" />
          </div>
        }
      />
    </div>
  )
}
