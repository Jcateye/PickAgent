## Context

员工工作台已经有 Dashboard、Connectors、SKU 健康等页面骨架，但仍处于静态占位阶段。该模块的目标不是等待全部后端服务先成熟，而是先把“运营总览与 SKU 健康”做成一个独立可演示业务模块，页面交互、读模型消费形态和路由关系先稳定，再把真实查询接口放到模块最后联调。

该模块是员工工作台的基础浏览面，后续活动模拟、Review 和 Agent 上下文联动都要复用它的页面入口与对象语义。

## Goals / Non-Goals

**Goals:**
- 提供 Dashboard 总览、Connectors 状态、SKU 健康列表与详情页面。
- 冻结页面消费的数据形状，允许开发期使用 mock 数据驱动 UI。
- 保持从列表到详情、从 Dashboard 到对象页的确定性导航关系。
- 在模块最后接入真实 summary / sku / connector / workflow 查询接口。

**Non-Goals:**
- 不在本模块中实现活动规则解析与准入模拟。
- 不在本模块中实现 Review 审批决策。
- 不在本模块中承载 Agent Copilot 会话逻辑。
- 不在页面层重算健康结论或推导底层规则。

## Decisions

1. 页面统一消费 read model / DTO，而不是直接拼装底层数据库模型。这样 mock 阶段与真实联调阶段可共享同一前端 contract。
2. 该模块内部按“Dashboard → Connectors → SKU 列表 → SKU 详情 → 最近运行摘要 → 最终联调”的顺序推进，避免页面并发开发时对象语义不一致。
3. Dashboard 只展示摘要、风险聚合和入口，不展开活动模拟或 Review 细节。这样可以保持 one page = one primary job 的设计原则。
4. Connectors 页面只承担状态查看和最近采集摘要，不承担插件控制逻辑。这样能保证插件模块和员工工作台模块边界清晰。
5. SKU 详情页优先呈现状态、问题、证据摘要和下一步动作，不在详情页中内嵌复杂的跨模块操作。这样可以让后续活动模拟、Review 和 Agent 以链接方式进入，而不是把全部能力堆在详情页。

## Risks / Trade-offs

- [页面提前绑定真实接口字段] → 先冻结前端 DTO，再通过 adapter 将真实接口映射进去。
- [Dashboard 试图承载过多业务信息] → 只保留总览与导航职责，把深入分析留给子模块页面。
- [SKU 页面与后续模块对象语义不一致] → 在本模块中先统一列表项、详情对象和状态字段命名。
- [Connectors 页面与插件模块耦合过深] → 仅展示连接状态与最近采集摘要，不直接操作插件运行流程。

## Migration Plan

1. 使用 mock DTO 完成页面结构、状态与导航。
2. 固化 Dashboard、Connector、SKU 列表与详情的字段 contract。
3. 在模块尾部接入真实查询接口并替换 mock adapter。
4. 在跨模块联调 change 中验证从插件采集结果到工作台展示的链路。

## Completion Gate

- Dashboard、Connectors、SKU 列表、SKU 详情和最近运行摘要能用 mock DTO 完整演示。
- 页面 contract 已冻结，字段命名与 `CurrentSkuProjection`、summary DTO、SKU detail DTO 保持一致。
- 页面不在前端重新计算健康状态、数据质量分或下一步动作，只展示服务端 DTO。
- 真实查询接口未完成时，本模块可声明“UI 与 contract 已完成，不阻塞”；真实数据验收必须等待 `backend-business-foundation` 完成 projection / query 能力。

## Open Questions

- SKU 详情页第一版是否需要包含历史趋势占位。
- Workflow 摘要在本模块内展示到什么粒度最合适。
- Connectors 页面是否需要展示多平台占位，还是只展示插件连接状态。
