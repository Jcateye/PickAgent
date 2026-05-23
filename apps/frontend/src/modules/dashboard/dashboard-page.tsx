import { PageHeader } from '@/shared/ui/page-header'
import { SummaryPanel, TwoColumnScaffold } from '@/shared/ui/page-scaffolds'

export function DashboardPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="Dashboard 总览"
        description="总览页只承接风险摘要、人工介入入口和主控台的导航焦点；真实业务数据待接口接入后展示。"
      />
      <section className="kpiGrid">
        <SummaryPanel title="监控 SKU" description="用于承接监控范围摘要。" state="skeleton" />
        <SummaryPanel title="Ready" description="用于承接可推进数量摘要。" state="skeleton" />
        <SummaryPanel title="Repairable" description="用于承接可修复数量摘要。" state="skeleton" />
        <SummaryPanel title="Risky" description="用于承接风险数量摘要。" state="skeleton" />
        <SummaryPanel title="Blocked" description="用于承接阻断数量摘要。" state="skeleton" />
        <SummaryPanel title="数据质量" description="用于承接数据质量摘要。" state="skeleton" />
      </section>
      <TwoColumnScaffold
        main={
          <div className="pageStack">
            <SummaryPanel title="风险分布" description="按活动口径聚合的风险摘要将显示在这里。" />
            <SummaryPanel title="最近采集 / 最近模拟" description="运行记录与关键状态变化将在这里承接。" state="unavailable" />
          </div>
        }
        side={
          <div className="pageStack">
            <SummaryPanel title="Pending Reviews" description="人工审批门在后端就绪后接入。" state="unavailable" />
            <SummaryPanel title="快捷入口" description="当前先保留导航结构与动作容器。" />
            <SummaryPanel title="Workflow Runs" description="工作流摘要区域已预留。" state="unavailable" />
          </div>
        }
      />
    </div>
  )
}
