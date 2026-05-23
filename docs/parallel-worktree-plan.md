# 并行 worktree 分工计划

日期：2026-05-23

## 1. 目标

按 OpenSpec 依赖关系把开发拆成多层推进：

```text
同一层：多个需求并行，每个需求一个独立 worktree。
层内完成：逐个 review，通过后合并到集成分支。
下一层：只在上一层全部合并且 review 合格后开始。
```

这个计划保留业务模块边界：

- 一个业务模块由一个 worktree 串行维护。
- 不把一个业务模块拆成多个需求并行抢改。
- 后端共享基座单独一个 worktree，承接会阻塞多个业务模块的真实 service。
- 跨模块联调只在最后一层做，不提前把所有模块绑死。

## 2. 术语与边界

### 2.1 OpenSpec change 与 worktree

每个 OpenSpec change 对应一个长期 worktree：

| Change | Worktree 分支 | 主要责任 |
|---|---|---|
| `backend-business-foundation` | `codex/l1-backend-business-foundation` | 后端业务基座 |
| `browser-extension-full-ingest` | `codex/l1-browser-extension-full-ingest` | 浏览器插件与页面采集 |
| `staff-workbench-health-console` | `codex/l1-staff-health-console` | 员工工作台 Dashboard / Connectors / SKU 健康 |
| `staff-workbench-activity-simulation` | `codex/l1-staff-activity-simulation` | 活动规则与准入模拟 |
| `staff-workbench-review-reporting` | `codex/l1-staff-review-reporting` | Review 工作台与报告 |
| `agent-copilot-workbench` | `codex/l1-agent-copilot-workbench` | Agent Copilot 工作台 |
| `cross-module-integration-and-acceptance` | `codex/l4-cross-module-integration` | 统一联调与最终验收 |

建议 worktree 路径：

```text
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/backend-business-foundation
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/browser-extension-full-ingest
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/staff-health-console
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/staff-activity-simulation
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/staff-review-reporting
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/agent-copilot-workbench
/Users/haoqi/OnePersonCompany/PickAgent.worktrees/cross-module-integration
```

### 2.2 抖店插件目标

插件首个平台先支持抖店。这里的“第一批目标页面”不是只问平台名，而是要固定一个可验证页面类型。建议第一版锁定：

```text
平台：抖店
页面类型：商品列表 / 商品管理列表页
核心动作：识别列表页、提取当前页商品行、字段映射预览、受控翻页采集、提交 ingest payload
```

开发前需要提供或沉淀一份抖店页面 fixture：

- 页面截图或录屏。
- 可脱敏 HTML 片段，至少包含列表行、分页器、关键字段。
- 第一版字段清单：商品 ID / SKU ID、标题、价格、库存、类目、状态、活动标签、更新时间等。
- 翻页方式：传统分页、滚动加载，还是需要点击下一页。

### 2.3 Hermes 与 Pi

Hermes 是本项目的 Agent 工程层名称，负责 Agent Copilot 的工程化落地：

```text
Hermes 工程
├── Agent Copilot 前端工作台
├── AgentMissionService / AgentRun / Event / Gate
├── AgentToolRegistry
├── AgentLoopAdapter
└── Pi runtime 接入
```

Pi 是 Hermes 内部可选/确认使用的 agent harness 框架组件。根据 [`earendil-works/pi`](https://github.com/earendil-works/pi) 当前 README，Pi mono repo 包含 agent harness、`pi-agent-core` runtime、tool calling/state management 与 unified LLM API。项目内不让 Pi 直接访问业务数据库，也不让 Pi 默认 coding/file/bash 工具进入业务 Agent；所有业务能力必须经过 `AgentToolRegistry`。

## 3. 分层推进

### Layer 0：协作准备层

目标：准备分支、worktree、协作规则和验收格式。

任务：

- 从最新 `main` 创建每个需求 worktree。
- 每个 worktree 读取对应 OpenSpec change、`docs/architecture.md`、`docs/engineering-rules.md`、`design.md`。
- 每个 worktree 只能改自己责任范围；共享 contract 变更优先进入 `backend-business-foundation`。
- 每个 worktree 每次完成一个 requirement 后提交代码，提交说明用中文写清楚完成的需求。

建议命令模板：

```bash
mkdir -p /Users/haoqi/OnePersonCompany/PickAgent.worktrees
git worktree add /Users/haoqi/OnePersonCompany/PickAgent.worktrees/backend-business-foundation -b codex/l1-backend-business-foundation main
git worktree add /Users/haoqi/OnePersonCompany/PickAgent.worktrees/browser-extension-full-ingest -b codex/l1-browser-extension-full-ingest main
git worktree add /Users/haoqi/OnePersonCompany/PickAgent.worktrees/staff-health-console -b codex/l1-staff-health-console main
git worktree add /Users/haoqi/OnePersonCompany/PickAgent.worktrees/staff-activity-simulation -b codex/l1-staff-activity-simulation main
git worktree add /Users/haoqi/OnePersonCompany/PickAgent.worktrees/staff-review-reporting -b codex/l1-staff-review-reporting main
git worktree add /Users/haoqi/OnePersonCompany/PickAgent.worktrees/agent-copilot-workbench -b codex/l1-agent-copilot-workbench main
```

Layer 0 完成条件：

- worktree 创建完成。
- 每个 worktree 有对应 Codex 会话或任务说明。
- 每个负责人明确自己的 OpenSpec change 和禁止越界范围。

### Layer 1：Mock 闭环与 contract 层

目标：并行推进所有业务模块的 mock 闭环，同时后端基座先冻结共享 schema / fixture。

并行 worktree：

| Worktree | Layer 1 交付 |
|---|---|
| backend-business-foundation | DTO / Zod schema / fixture；service 骨架；下游 contract 草案 |
| browser-extension-full-ingest | 抖店商品列表识别、当前页提取、字段映射预览、run state、mock submit |
| staff-health-console | Dashboard / Connectors / SKU list/detail mock DTO 展示 |
| staff-activity-simulation | 规则录入、结构化规则、模拟结果、what-if mock |
| staff-review-reporting | Review 列表/详情/决策、报告预览 mock |
| agent-copilot-workbench | Mission、Plan、Trace、Context、Review Gate fake run |

Layer 1 完成条件：

- 每个模块 mock 闭环可演示。
- 每个模块有 fixture 或 mock provider。
- 每个模块明确真实接入依赖。
- `scripts/typecheck` 通过；可运行测试的模块运行 `scripts/test` 或模块级测试。
- 每个模块在 `tasks.md` 中只勾选真实完成项，不勾选真实接入项。

合并策略：

1. 先 review 并合并 `backend-business-foundation` 的 contract / fixture 部分。
2. 再合并 5 个业务模块的 mock 闭环。
3. 如果 contract 冲突，以 `backend-business-foundation` 为准，各模块小范围跟进。

### Layer 2：后端真实业务能力层

目标：完成上层真实接入所需的后端业务基座。

主 worktree：

- `backend-business-foundation`

交付顺序：

1. `IngestService` / `NormalizationService`
2. `HealthAssessmentService` / `SkuQueryService` / `CurrentSkuProjection`
3. `ActivityRuleService` / Canonical Rule DSL / parse status
4. `ActivitySimulationService` / what-if / evidence / repair suggestion
5. `ReviewService` / `ReportService`
6. `AgentToolRegistry` / fake runtime adapter boundary

Layer 2 完成条件：

- 核心 service 有最小单测。
- fixture 能跑通 ingest → projection、rule → simulation、simulation → review/report、tool → service。
- 明确输出下游解锁清单：
  - 插件真实 ingest 是否不阻塞。
  - 健康工作台真实查询是否不阻塞。
  - 活动模拟真实 parse / simulation 是否不阻塞。
  - Review/报告真实接口是否不阻塞。
  - Agent tools 是否不阻塞。

合并策略：

- 该层优先合并后端基座。
- 其他业务 worktree 不抢写后端 service，只能补 adapter 或消费端最小调整。

### Layer 3：真实接入层

目标：各业务模块把 mock adapter 替换为真实接口。

并行 worktree：

| Worktree | Layer 3 交付 | 依赖 |
|---|---|---|
| browser-extension-full-ingest | 抖店采集 payload 提交真实 ingest | ingest / projection 不阻塞 |
| staff-health-console | 接真实 summary / connector / sku / workflow 查询 | SkuQueryService 不阻塞 |
| staff-activity-simulation | 接真实 rule parse / simulation / what-if | Rule / Simulation 不阻塞 |
| staff-review-reporting | 接真实 review / report | Review / Report 不阻塞 |
| agent-copilot-workbench | 接真实 AgentToolRegistry / Pi adapter | Agent tools 不阻塞 |

Layer 3 完成条件：

- 用户交互结构不因真实接口接入发生大改。
- mock provider 仍可作为 fallback 或测试 fixture。
- 每个模块有 smoke test、截图、录屏或命令验证记录。
- 每个模块可声明“已完成，不阻塞”，或列出阻塞项归属。

合并策略：

1. 先合并插件与健康工作台真实接入，因为它们验证数据事实链路。
2. 再合并活动模拟与 Review/报告。
3. 最后合并 Agent 真实工具接入。

### Layer 4：统一联调与验收层

目标：只做连接、验证、问题回流和最终验收，不新增单点业务功能。

主 worktree：

- `cross-module-integration-and-acceptance`

联调顺序：

1. 后端业务基座 readiness 校验。
2. 抖店插件 → ingest → SKU 健康工作台。
3. 活动规则 → 模拟 → Review → 报告。
4. 员工工作台上下文 → Agent Mission → Agent tool → Review Gate。
5. 最终演示脚本与技术验收清单。

Layer 4 完成条件：

- 所有主链路通过。
- 阻塞问题有归属模块、修复分支和回归结果。
- 输出中文验收结论：每个需求是否“已完成，不阻塞”。
- 遗留风险被明确标注为阻塞或非阻塞。

## 4. 每个 Codex worktree 的启动指令模板

给每个 Codex 会话的任务建议使用这个结构：

```text
你在独立 worktree：<worktree path>
当前分支：<branch>
负责 OpenSpec change：<change id>

先阅读：
- AGENTS.md
- docs/agents/profile.md
- docs/agents/workspace-template.md
- CONTEXT.md
- docs/architecture.md
- docs/engineering-rules.md
- design.md
- openspec/changes/<change id>/proposal.md
- openspec/changes/<change id>/design.md
- openspec/changes/<change id>/tasks.md
- openspec/changes/<change id>/specs/**/spec.md

执行要求：
- 只做本 change 范围内的任务。
- 每完成一个 requirement，提交一次代码，commit message 用中文说明完成内容。
- 不要跨模块改业务逻辑；需要共享 contract 或后端 service 时，先记录依赖或回流到 backend-business-foundation。
- 完成后运行必要验证，并在最终回复里给出验证命令、结果、阻塞项和下一层依赖。
```

## 5. Review 清单

每个 worktree 合并前必须回答：

```text
1. 本层完成了哪些 OpenSpec task？
2. 是否存在跨模块越界改动？
3. contract / schema 是否和 backend-business-foundation 对齐？
4. mock fixture 是否可复现？
5. 运行了哪些验证命令？结果是什么？
6. 哪些真实接入还被阻塞？阻塞归属是谁？
7. 是否可以声明：已完成，不阻塞？
```

## 6. 你需要配合的事项

### 6.1 抖店页面 fixture

需要你提供或授权 Codex 从本地浏览器/文件中获取：

- 抖店商品列表页截图或录屏。
- 脱敏 HTML 片段或页面保存文件。
- 第一版必须采集字段。
- 翻页交互方式。

如果暂时没有真实 HTML，插件 worktree 先用 synthetic fixture 开发，Layer 3 前必须替换为真实抖店 fixture。

### 6.2 并发调度

你可以把 Layer 1 的 6 个 worktree 同时分给 Codex。建议先启动 `backend-business-foundation`，等它输出 contract 草案后，再启动其他 5 个，减少 DTO 返工。

### 6.3 合并节奏

每层合并前你只需要做三件事：

```text
1. 看演示或截图。
2. 看验证结果。
3. 看阻塞清单。
```

如果三项都清楚，就合并该 worktree；如果阻塞项归属不清，不合并到下一层。

## 7. 推荐的第一步

先执行 Layer 0：

1. 创建 6 个 Layer 1 worktree。
2. 给 `backend-business-foundation` 的 Codex 发任务，让它先冻结共享 DTO / schema / fixture。
3. 你补一份抖店商品列表页 fixture。
4. 等 backend contract 草案出来后，启动其他 5 个 Codex 并行做 mock 闭环。
