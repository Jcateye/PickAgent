import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel, TwoColumnScaffold } from '@/shared/ui/page-scaffolds'

export function ReviewsPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="Review 工作台"
        description="左侧 Review Queue，右侧 Review Detail。当前只落地审批门结构，不接真实 review items。"
      />
      <TwoColumnScaffold
        main={<SummaryPanel title="Review Queue" description="审批队列筛选与列表结构已准备完成。" />}
        side={
          <div className="pageStack">
            <SummaryPanel title="Review Detail" description="详情容器保留为结构化问题、建议、风险与证据区块。" />
            <SummaryPanel title="Decision Bar" description="按钮与动作区仅保留布局，等待后端能力接入。" state="unavailable" />
          </div>
        }
      />
    </div>
  )
}
