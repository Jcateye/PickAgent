# Backend Business Foundation Readiness

## Layer 1 Scope

本清单只覆盖 `backend-business-foundation` 的 Layer 1：共享 DTO / contract、seed fixture、mock/service 骨架、Agent Tool Registry 边界和验证信号。

## 已完成，不阻塞

- `browser-extension-full-ingest`：已有 `IngestPayloadDto`、fixture 与 `IngestService` mock 闭环，可替换插件提交 payload 做 contract 对齐。
- `staff-workbench-health-console`：已有 `SkuSummaryDto`、`SkuDetailDto`、`SkuQueryService` 与 health summary/list/detail mock 读模型。
- `staff-workbench-activity-simulation`：已有 Canonical Rule DSL、parse status/confidence/errors、simulation 和 what-if DTO/service。
- `staff-workbench-review-reporting`：已有 `ReviewItemDto`、决策流转、`ReportPreviewDto`、章节结构与 evidence summary。
- `agent-copilot-workbench`：已有 `AgentToolRegistry` 最小工具集合与 fake/runtime adapter 边界，工具通过 application service 执行。

## 仍然显式阻塞

- 真实数据库事务、Prisma repository 接线和生产 API route 不在 Layer 1 范围内，进入 Layer 2 后处理。
- 真实平台 API、ERP 接口、权限系统、自动改价/报名/修改商品信息不在本 change 范围内。
- 真实 Pi/Hermes runtime 联调不在 Layer 1 范围内；当前只声明 fake/runtime adapter contract 不阻塞 UI 接线。

## 判定

Layer 1 已完成，不阻塞下游模块继续从 mock/contract 接入推进；不能声明真实生产链路联调完成。
