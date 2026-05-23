import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel } from '@/shared/ui/page-scaffolds'

export function WorkflowsPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="Workflows"
        description="工作流页承接运行摘要与时间线表达。当前只保留结构，不展示真实 run / step 数据。"
      />
      <SummaryPanel title="当前工作流" description="timeline 容器和步骤明细二层结构已预留。" state="unavailable" />
    </div>
  )
}
