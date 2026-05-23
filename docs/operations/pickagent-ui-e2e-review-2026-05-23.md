# PickAgent UI E2E 验收记录

日期：2026-05-23

## 验收范围

本轮按用户要求跳过真实抖店页面加载、解析、自动翻页和分页点击链路。

本轮覆盖 PickAgent 产品内 UI：

- Activities：活动规则解析、准入模拟、what-if 输入与结果刷新。
- Reviews：Review 队列筛选、详情、审批动作。
- Agent Chat：Mission 输入、Review Gate 批准继续、状态变化。
- Reports：报告预览、导出状态切换、未解决风险展示。
- SKU Health：列表到详情路由跳转。
- 移动端：核心页面 390px 视口横向溢出检查。

## 验收环境

- 开发模式：`PORT=3105 pnpm --dir apps/frontend dev`
- 生产构建：`scripts/build frontend`
- 生产模式：`PORT=3106 pnpm --dir apps/frontend start`
- 浏览器自动化：Playwright CLI

## 通过项

- `/activities` 能加载到真实 `ActivitySimulationService` 接入状态，what-if 修改后能显示服务端重跑结果。
- `/reviews` 能执行批准动作，页面内状态反馈能更新为已批准。
- `/agent-chat` 能发起/继续 Mission，并在 Review Gate 批准后显示 `Gate 决策：approve`。
- `/reports` 能切换导出状态为“已请求导出”。
- `/sku-health` 列表行能进入 `/sku-health/:skuProfileId` 详情路由。
- 生产模式下 `/activities`、`/reviews`、`/agent-chat`、`/reports` 在 390px 视口未发现横向溢出。

## 新发现问题

### P1：Reports 存在 React hydration mismatch 风险

现象：

- 开发模式 `/reports` 明确报 hydration mismatch，服务端文本和客户端文本中的 report id 不一致。
- 生产模式核心 E2E 中也捕获到 React minified error `#418`，属于文本 hydration mismatch。

证据：

- 开发日志显示服务端渲染为 `report_0010`，客户端 hydration 为 `report_0021`。
- 触发点在报告预览 ID。

疑似原因：

- `ReportsPage` 是 client component，并在 `useState(() => createReportProviderSnapshot())` 中创建报告快照。
- `createReportProviderSnapshot()` 会创建 `BusinessFoundationRuntime` 并调用 `reportService.generatePreview()`。
- `ReportService.generatePreview()` 使用模块级 `sequence` 生成 `reportId`。
- SSR 和客户端 hydration 重算同一快照时，模块级序列不稳定，导致文本不一致。

设计完善方向：

- UI 不应在 client component 内即时重建业务 runtime 快照。
- 报告预览应来自稳定的 server/API snapshot，或使用确定性 fixture/seed。
- DTO 的 id、generatedAt、sections 等首屏字段必须在 SSR 和客户端 hydration 间保持一致。

相关位置：

- `apps/frontend/src/modules/report/reports-page.tsx`
- `apps/frontend/src/modules/report/report-service-provider.ts`
- `apps/backend/src/application/foundation/BusinessFoundationServices.ts`

### P1：证据链和 Review Gate 缺少可点击追溯闭环

现象：

- `/activities` 主内容区没有任何链接；manual review 结果只展示“Review 来源”，没有进入 Review 工作台或创建/查看 Review item 的入口。
- `/agent-chat` Gate 批准后，next action 只是文本，没有链接到 Review 工作台、具体 gate、run event 或 evidence。
- `/reports` 主内容区没有任何链接；Evidence Summary 是静态行，不能跳到 evidence/source/run。
- `/reviews` 的“对象入口”是按钮，但点击后没有导航、抽屉或详情展开。

这和最终设计里的“每个 AI 结论必须能链接到 evidence、rule、run、tool trace 或 review gate”还没有对齐。

设计完善方向：

- 为 evidence/source/review/run 统一定义 `entityType + entityId + href` 或 drawer target。
- Activities 的 `MANUAL_REVIEW` 结果要能创建或定位 Review item。
- Agent Gate 批准后至少提供“查看 Review Gate / 查看 Review 工作台 / 查看 Run Trace”的明确入口。
- Reports 的 evidence summary 应可点击展开或跳转来源对象。
- Reviews 的“对象入口”不能是空按钮，应变成链接或打开来源详情抽屉。

相关位置：

- `apps/frontend/src/modules/activity/activities-page.tsx`
- `apps/frontend/src/modules/chat/agent-chat-page.tsx`
- `apps/frontend/src/modules/report/reports-page.tsx`
- `apps/frontend/src/modules/review/reviews-page.tsx`

### P2：Review 决策只在页面内临时生效

现象：

- `/reviews` 批准动作后，当前页面会显示状态反馈。
- 刷新页面后，决策反馈消失，状态回到 provider 初始快照。

这符合当前“真实落库未完成”的限制，但从 UI E2E 角度看，Review Gate 闭环还不能算产品级完成。

设计完善方向：

- Review decision 应通过 API 写入稳定 Review store。
- Reports 和 Agent next action 应消费同一个 Review decision 状态，而不是各自展示静态快照。

## 证据截图

- `output/playwright/ui-e2e-prod-activities.png`
- `output/playwright/ui-e2e-prod-reviews.png`
- `output/playwright/ui-e2e-prod-agent-chat.png`
- `output/playwright/ui-e2e-prod-reports.png`
- `output/playwright/ui-e2e-prod-sku-health.png`
- `output/playwright/ui-e2e-reports-production.png`
- `output/playwright/ui-e2e-activities-mobile.png`
- `output/playwright/ui-e2e-reviews-mobile.png`
- `output/playwright/ui-e2e-agent-chat-mobile.png`
- `output/playwright/ui-e2e-reports-mobile.png`
- `output/playwright/ui-e2e-sku-health-mobile.png`

## 当前结论

Layer 4 的技术联调可以继续维持“不阻塞”结论，但 UI E2E 显示它还不是最终设计目标里的完整产品闭环。

下一轮设计完善应优先补：

1. 稳定的 SSR/client 数据快照边界，先处理 Reports hydration mismatch。
2. Evidence / source object / review gate 的统一可点击追溯模型。
3. Review decision 的持久化和跨页面状态联动。
