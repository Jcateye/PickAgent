import { PageHeader } from '@/shared/ui/page-header'
import { EmptyStatePanel } from '@/shared/ui/empty-state-panel'
import { Panel, PanelBody, PanelHeader } from '@/shared/ui/panel'
import { UnavailableStatePanel } from '@/shared/ui/unavailable-state-panel'

export function AgentChatPage() {
  return (
    <div className="pageStack">
      <PageHeader
        title="Agent Chat"
        description="自然语言控制台作为主控台中的一个 surface 存在。当前仅实现对话区、输入区和右侧 trace / evidence / entities 窄栏结构。"
        actions={
          <>
            <button className="secondaryButton" type="button" disabled>
              查看历史会话
            </button>
            <button className="primaryButton" type="button" disabled>
              新建对话
            </button>
          </>
        }
      />

      <section className="twoColumnScaffold">
        <div className="twoColumnMain pageStack">
          <Panel>
            <PanelHeader title="Conversation" description="主区域承接对话流，当前不展示任何静态业务示例数据。" />
            <PanelBody>
              <EmptyStatePanel
                title="等待后端对话能力接入"
                description="接口就绪后，这里将展示用户消息、Agent 回复、工具调用状态与相关上下文。"
                actionLabel="发送消息"
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Composer" description="输入区结构已预留，当前仅保留占位布局。" />
            <PanelBody>
              <div className="chatComposerShell">
                <input
                  className="chatComposerInput"
                  readOnly
                  value="例如：请解释为什么该活动规则仍不能推进。"
                  aria-label="对话输入占位框"
                />
                <button className="primaryButton" type="button" disabled>
                  发送
                </button>
              </div>
            </PanelBody>
          </Panel>
        </div>

        <aside className="twoColumnSide pageStack">
          <Panel>
            <PanelHeader title="Tool Trace" description="展示工具调用与执行结果的侧栏已预留。" />
            <PanelBody>
              <UnavailableStatePanel
                title="等待工具链接入"
                description="后端就绪后，这里将展示调用的系统能力、执行状态与 trace。"
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Linked Evidence" description="展示对话关联证据的结构已预留。" />
            <PanelBody>
              <UnavailableStatePanel
                title="等待证据链接入"
                description="后端就绪后，这里将展示本轮对话关联的 evidence、rule、run 与 review gate。"
              />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Linked Entities" description="展示会话关联对象的结构已预留。" />
            <PanelBody>
              <UnavailableStatePanel
                title="等待对象上下文接入"
                description="后端就绪后，这里将展示当前会话命中的 SKU、活动、店铺或其他业务对象。"
              />
            </PanelBody>
          </Panel>
        </aside>
      </section>
    </div>
  )
}
