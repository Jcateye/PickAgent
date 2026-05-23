# PickAgent Frontend

`apps/frontend/` 承载 SKU Ready Agent 的 **集中式总控制台**。

## 目标

为运营、商品、供应链、法务/风控与管理层提供统一的查询、模拟、审批与报告入口。

它不是一个单纯的聊天壳，而是业务主控制台。

## 计划承载的页面

- Dashboard
- Connectors
- SKU List
- SKU Detail
- Activities / Rule Parse
- Simulation Result
- Review Workbench
- Reports
- Chat
- Workflows

## 当前职责边界

前端负责：

- 页面布局与导航
- 录入规则、筛选条件、审批动作
- 展示 DTO / projection / report
- 展示 Chat conversation 与 tool trace

前端不负责：

- 健康诊断计算
- 规则引擎执行
- 准入模拟计算
- 证据链生成
- Review 决策逻辑

## 建议目录

```txt
apps/frontend/
  src/
    app/
    modules/
      dashboard/
      sku/
      activity/
      review/
      report/
      chat/
      workflow/
    shared/
      api/
      ui/
      hooks/
      config/
      utils/
```

## 数据依赖原则

- Dashboard、SKU List、Chat summary 优先读取 `CurrentSkuProjection`
- SKU Detail 读取聚合详情 DTO，不在前端自己拼 latest snapshot + diagnosis
- Activity / Simulation 页面展示服务端输出的 Rule DSL 与 SimulationResult
- Review Workbench 展示结构化 `ReviewItem`

## 与服务端交互原则

- 统一通过 HTTP API 与 contracts 交互
- 页面按钮与 Chat tool 复用同一套服务端 service 能力
- 不把服务端业务逻辑复制到 React 层

## 技术栈

- Next.js
- React
- assistant-ui
- Zod client schema

## 当前状态

- 前端 UI 与页面树已在 `claude_prd_report.html` 中确认
- 工程骨架与目录尚未正式初始化
