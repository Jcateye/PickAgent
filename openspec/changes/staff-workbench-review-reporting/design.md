## Context

Review 工作台与报告输出承接人工确认和业务结果呈现，是员工工作台中的独立业务模块。它虽然会接收活动模拟与 Agent 运行生成的对象，但这些交互不应该在开发前期形成阻塞。该模块需要先稳定 Review 列表、详情、决策区和报告预览页结构，前期允许 mock Review 项和 mock 报告数据推进，模块最后再做真实接口联调。

## Goals / Non-Goals

**Goals:**
- 提供 Review 列表、详情、证据区和决策动作区。
- 提供报告预览与导出占位页面。
- 保持 Review 与报告模块内部任务串行推进。
- 在模块最后接入真实 review / report 接口。

**Non-Goals:**
- 不在本模块中实现活动规则解析。
- 不在本模块中实现插件采集。
- 不在本模块中承载 Agent run 生命周期。
- 不在本模块中重新定义底层业务真相，只消费 Review 与报告 DTO。

## Decisions

1. Review 列表、Review 详情和决策动作按单一工作流组织，而不是散落到多个业务页面。这样更利于后续分派给单独负责人推进。
2. 决策动作区只承载批准、驳回、修改等明确动作，不混入活动模拟编辑或 Agent 会话。这样可以保证审批职责清晰。
3. 报告页优先实现预览与输出状态，不把“报告生成过程”混入本模块。这样报告模块可以在 mock 阶段先稳定阅读体验。
4. Review 与报告页面都消费结构化 DTO，开发阶段由 mock provider 提供，联调阶段替换为真实 API。这样可以避免前端页面被后端时序阻塞。
5. manual review 提示由上游模块产生，但正式审批与结果查看统一在本模块承接。

## Risks / Trade-offs

- [Review 来源多样导致列表混乱] → 先统一列表字段与筛选维度，再接入不同来源数据。
- [审批动作与业务影响不清] → 在详情页固定展示问题、建议、风险与证据摘要。
- [报告页变成杂糅的下载页面] → 先聚焦报告预览、章节结构和输出状态，再补导出动作。
- [过早与上游模块强耦合] → 用 mock Review 项和 mock 报告 DTO 先稳定本模块 contract。

## Migration Plan

1. 使用 mock Review 数据实现列表、详情与决策流。
2. 使用 mock 报告数据实现预览和导出占位。
3. 在模块尾部接入真实 review / report API。
4. 在跨模块联调 change 中验证活动模拟与 Agent 输出对象能正确进入本模块。

## Completion Gate

- Review 列表、筛选、详情、批准/驳回/修改动作、报告预览和导出占位能用 mock DTO 完整演示。
- Review DTO 包含来源类型、来源对象、问题、建议、风险、证据摘要和决策状态。
- 报告 DTO 包含报告类型、章节结构、摘要内容、输出状态和 evidence summary。
- 模块不重新生成活动模拟、不重新解释 Agent run，只消费上游来源对象和服务端 Review/Report DTO。
- 真实 review / report 未完成时，本模块可声明“UI 与 contract 已完成，不阻塞”；真实审批和报告验收必须等待 `backend-business-foundation` 完成 ReviewService / ReportService。

## Open Questions

- 第一版 Review 列表需要哪些筛选维度。
- 报告页是否需要区分活动报告与健康报告两个模板。
- 修改决策是否需要结构化表单，还是文本说明即可。
