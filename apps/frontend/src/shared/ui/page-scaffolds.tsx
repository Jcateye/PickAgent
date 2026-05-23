import type { ReactNode } from 'react'

import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { SkeletonCard } from '@/shared/ui/skeleton-card'
import { SkeletonTable } from '@/shared/ui/skeleton-table'
import { EmptyStatePanel } from '@/shared/ui/empty-state-panel'
import { UnavailableStatePanel } from '@/shared/ui/unavailable-state-panel'
import { AppDrawer } from '@/shared/ui/app-drawer'
import { AppModal } from '@/shared/ui/app-modal'
import { CollapseSection } from '@/shared/ui/collapse-section'

interface PageScaffoldProps {
  main: ReactNode
  side?: ReactNode
  bottom?: ReactNode
}

export function TwoColumnScaffold({ main, side, bottom }: PageScaffoldProps) {
  return (
    <div className="twoColumnScaffold">
      <div className="twoColumnMain">{main}</div>
      {side ? <div className="twoColumnSide">{side}</div> : null}
      {bottom ? <div className="twoColumnBottom">{bottom}</div> : null}
    </div>
  )
}

export function SummaryPanel(props: {
  title: string
  description: string
  state?: 'skeleton' | 'empty' | 'unavailable'
}) {
  const { title, description, state = 'empty' } = props

  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <PanelBody>
        {state === 'skeleton' ? <SkeletonCard lines={4} /> : null}
        {state === 'empty' ? (
          <EmptyStatePanel title="暂无数据" description="当前页面结构已准备完成，等待后端接口就绪后接入真实内容。" />
        ) : null}
        {state === 'unavailable' ? (
          <UnavailableStatePanel title="等待后端就绪" description="该区域依赖后端能力，本次仅实现 UI 壳层和交互结构。" />
        ) : null}
      </PanelBody>
    </Panel>
  )
}

export function TableShellPanel(props: { title: string; description: string; columns?: number }) {
  const { title, description, columns = 6 } = props

  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <PanelBody>
        <SkeletonTable columns={columns} rows={6} />
      </PanelBody>
    </Panel>
  )
}

export function ExampleDrawerShell() {
  return (
    <AppDrawer title="证据链侧栏" description="用于承接不适合常驻主页面的长证据、规则命中、run 详情与字段来源。">
      <EmptyStatePanel title="等待对象上下文" description="等接口接入后，这里将展示当前对象相关的证据链、字段来源与 trace。" />
    </AppDrawer>
  )
}

export function ExampleModalShell() {
  return (
    <AppModal title="弹窗结构" description="预留规则说明、审批策略、过滤器和修复建议的承载空间。">
      <CollapseSection title="为什么保留弹窗容器" defaultOpen>
        <p className="mutedText">当前只实现结构，不在页面首屏平铺长说明与复杂二层信息。</p>
      </CollapseSection>
    </AppModal>
  )
}
