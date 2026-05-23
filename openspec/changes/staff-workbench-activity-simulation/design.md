## Context

活动规则与准入模拟是员工工作台中的独立业务场景。用户需要能粘贴规则、看到结构化结果、查看 SKU 模拟结论与修复建议，而不必等待 Review 或 Agent 工作台一起完成。为了支持多人并行开发，本模块需要先稳定页面结构和结果 contract，开发阶段允许 mock 先行，真实解析与模拟接口放到模块最后联调。

## Goals / Non-Goals

**Goals:**
- 提供活动规则录入与结构化规则展示页面。
- 提供准入模拟结果、失败原因与修复建议视图。
- 提供 what-if 入口以查看补货、改价等变更后的模拟结果。
- 在模块最后接入真实 rule parse 与 simulation 接口。

**Non-Goals:**
- 不在本模块中实现 Review 决策流程。
- 不在本模块中实现插件采集逻辑。
- 不在本模块中实现 Agent Copilot run 生命周期。
- 不在页面层重新解释底层长期健康规则。

## Decisions

1. 规则录入状态与模拟结果状态分离管理。这样用户可以先编辑和确认规则，再进入模拟阶段，避免把页面变成单一大表单。
2. 结构化规则展示先以 contract-first DTO 呈现，解析来源可以是 mock 或真实接口。这样前端可以先稳定字段、分组和 evidence 展示方式。
3. 模拟结果页面按“状态分组 + 失败规则 + 修复建议”组织，而不是仅展示单表格。这样更符合业务决策场景。
4. what-if 作为当前模块的子流程处理，不单独开模块。这样可以在同一业务面内承接“如果补货后会怎样”这类问题。
5. 最终联调时只替换解析与模拟数据源，不改变录入页、结构化规则区和结果区的交互骨架。

## Risks / Trade-offs

- [规则文本与结构化结果差异大] → 在页面中同时保留原文与结构化视图，降低理解偏差。
- [模拟结果信息量过大] → 优先展示状态分组和失败原因摘要，把更多细节放到展开层。
- [what-if 过早绑定真实业务字段] → 先用最小输入 contract 支撑 mock 场景，联调时再补真实字段映射。
- [与 Review 模块边界模糊] → 本模块只展示 manual review 提示，不承载审批动作。

## Migration Plan

1. 用 mock 规则、mock 解析结果和 mock 模拟结果完成页面闭环。
2. 固化 rule parse DTO、simulation summary DTO 和 what-if 输入输出 contract。
3. 在模块尾部接入真实解析与模拟接口。
4. 在跨模块联调 change 中将 manual review 输出连接到 Review 工作台。

## Completion Gate

- 规则录入、结构化规则、模拟结果、失败原因、修复建议和 what-if 能用 mock DTO 完整演示。
- Rule DSL、simulation summary、simulation result detail 和 what-if DTO 已冻结，并与后端 Zod schema 对齐。
- 模块只展示 manual review 提示和来源对象，不处理正式 Review 决策。
- 页面不重算长期健康状态，不把活动准入状态写回 SKU 健康结论。
- 真实 parse / simulation 未完成时，本模块可声明“UI 与 contract 已完成，不阻塞”；真实模拟验收必须等待 `backend-business-foundation` 完成 Rule DSL / Simulation 能力。

## Open Questions

- what-if 第一版需要支持哪些输入变量。
- 结构化规则是否需要内联编辑，还是只读展示。
- 状态分组结果是否需要默认排序策略。
