import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel, TableShellPanel, TwoColumnScaffold } from '@/shared/ui/page-scaffolds'

export function ActivitiesPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="活动规则与准入模拟"
        description="左侧承接规则输入，右侧承接结构化结果；模拟结果表与二层弹层均已预留。"
      />
      <TwoColumnScaffold
        main={<SummaryPanel title="活动规则输入" description="当前仅保留输入容器和布局层级，不触发真实解析。" />}
        side={<SummaryPanel title="解析后的 Rule DSL" description="接口接入后在这里展示可审查的结构化规则结果。" state="unavailable" />}
        bottom={
          <div className="pageStack">
            <section className="summaryGrid">
              <SummaryPanel title="Direct Ready" description="模拟结果摘要位。" state="skeleton" />
              <SummaryPanel title="Repairable" description="模拟结果摘要位。" state="skeleton" />
              <SummaryPanel title="Manual Review" description="模拟结果摘要位。" state="skeleton" />
              <SummaryPanel title="Blocked" description="模拟结果摘要位。" state="skeleton" />
            </section>
            <TableShellPanel title="模拟结果表" description="结果表结构与操作位已准备完成，等待后端返回正式数据。" columns={6} />
          </div>
        }
      />
    </div>
  )
}
