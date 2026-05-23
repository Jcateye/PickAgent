## Context

前五个业务模块都采用“业务模块优先、mock 先行、联调后置”的推进方式，底层共享业务能力由 `backend-business-foundation` 承接，因此需要一个独立的收口模块统一承接跨模块联调与最终验收。这个 change 不负责增加新的单点业务能力，而是负责把插件、员工工作台、活动模拟、Review/报告、Agent 工作台和后端业务基座连接成可演示、可验收、可分派回归的问题闭环。

Layer 3 已完成后，统一联调的设计口径以 `docs/final-design-gap-closure.md` 为准。该文档明确区分 L4 联调、P0 生产化和 P1 扩展能力，避免把当前 mock fallback 或 fake runtime 误判为最终完成。

## Goals / Non-Goals

**Goals:**
- 定义跨模块联调顺序、准入门槛和阻塞判定。
- 打通插件到员工工作台、活动模拟到 Review、员工工作台到 Agent、Agent 工具到真实业务服务的主链路。
- 建立最终验收清单与问题回归机制。
- 让“统一阻塞”只发生在本 change，而不是前置模块开发阶段。

**Non-Goals:**
- 不新增新的单点业务模块功能。
- 不在本 change 中重写前五个模块的内部任务结构。
- 不把所有缺陷都转移成架构重构任务。
- 不在前五个模块尚未达到基本完成前提前做大规模联调。

## Decisions

1. 联调顺序采用固定主链路推进：后端业务基座准入 → 插件 → ingest / SKU 健康 → 活动模拟 → Review / 报告 → Agent ↔ 工作台 ↔ 工具。这样能先保证数据事实链路，再打通决策与 Copilot 链路。
2. 只有“模块已完成且不阻塞”才允许进入统一联调。这样保留前期并行开发空间，避免共享能力成为早期借口。
3. 每条联调链路都要求记录输入、输出、阻塞点和回归结果，而不是只做口头验收。这样便于多人协作时追踪责任边界。
4. 统一验收聚焦端到端业务闭环，不把联调 change 变成另一个业务开发模块。
5. 发现问题后回流到对应业务模块修复，联调 change 只保留问题清单、状态与重新验证记录。
6. Layer 4 必须优先补 route binding、repository / transaction、Agent EventStore、SSE、Copilot Overlay 和可视化验收证据；真实 Pi runtime、sale price 来源和完整 auth 可按 `docs/final-design-gap-closure.md` 的阻塞等级推进。
7. UI E2E 发现的问题按 `docs/operations/pickagent-ui-e2e-review-2026-05-23.md` 回流到最终设计：Reports 稳定 snapshot、TraceableRef 追溯闭环、Review decision 持久化必须作为后续 L4/P0 验收口径。

## Risks / Trade-offs

- [联调过早开始导致大量假阻塞] → 只有模块达到就绪 gate 才进入统一联调。
- [问题来源不清晰] → 每条联调链路都记录模块边界和失败位置。
- [最终验收范围失控] → 仅验证预先定义的主链路与验收标准。
- [联调问题堆积无人处理] → 将问题回流到具体业务模块负责人并在本 change 记录回归状态。
- [单元测试通过但 UI 闭环不可用] → L4 验收必须加入 Playwright UI E2E，检查 hydration error、空按钮、不可追溯 evidence 和刷新后状态丢失。

## Migration Plan

1. 收集前五个模块的完成 gate 与接口 contract。
2. 按固定顺序执行主链路联调。
3. 记录阻塞点并回流修复。
4. 执行生产模式 UI E2E，确认 Activities / Reviews / Agent Chat / Reports / SKU Health 的交互闭环。
5. 复测通过后完成最终验收。

## Readiness Template

每个进入统一联调的模块都必须提供：

- mock 闭环演示路径。
- 已冻结的 contract、schema 或 DTO。
- fixture 或 seed 数据。
- 真实接入项依赖状态。
- 最小验证命令或测试结果。
- 明确声明“已完成，不阻塞”或列出阻塞项、所属模块和下一步。

## Layer 4 Chain Template

每条主链路都按同一格式记录：

- 链路名称：插件到 SKU 健康 / 活动模拟到 Review / 员工工作台到 Agent / Agent 到真实业务工具。
- 输入：fixture、seed、页面操作或 API request。
- 关键 route：本链路触达的 HTTP endpoint。
- 关键数据对象：会被创建或读取的 Prisma model / DTO。
- 验证证据：命令、HTTP smoke、截图、录屏或浏览器检查。
- UI E2E 证据：生产模式无 hydration/page error，核心按钮有动作，evidence/source/review/gate 可点击追溯，关键决策刷新后仍存在。
- 结论：通过 / 非阻塞风险 / 阻塞。
- 回流模块：阻塞问题所属 change 或模块。

## Open Questions

- 最终验收是否需要演示脚本版本与技术验收版本两套清单。
- 回归问题记录最终放在哪个协作介质最方便分派。
