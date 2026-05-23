## Why

当前浏览器插件已经有高保真 side panel 壳层，但还没有形成“识别页面、采集当前页、自动翻页获取全量数据、最后接入真实 ingest”的完整业务闭环。这个 change 需要先把插件作为独立业务模块落地，允许前期使用 mock 数据与假接口推进，最后再做真实联调。

## What Changes

- 交付浏览器插件的完整业务闭环：页面识别、字段提取、采集预览、自动翻页/循环采集、运行状态反馈。
- 明确插件模块内部采用串行任务推进，先完成本地与 mock 流程，再在模块最后接入真实 ingest API。
- 约束插件边界：只做页面采集与采集流程控制，不在插件内承载健康诊断、活动模拟、Review 决策或报告生成。
- 为后续跨模块联调提供稳定的插件输入契约与采集运行状态。

## Capabilities

### New Capabilities
- `browser-extension-ingest`: 浏览器插件识别商品列表页、采集字段并自动获取全量数据，最终将采集结果提交到服务端 ingest 接口。

### Modified Capabilities
- 无

## Impact

- Affected code: `apps/extension/`, `apps/contracts/`, 与 ingest API 对接层
- Affected systems: 浏览器插件 side panel / popup、目标页面 DOM 解析、分页采集流程
- Dependencies: 开发阶段允许使用 mock 数据与假接口；真实 ingest 联调依赖 `backend-business-foundation` 中 ingest / normalization / health projection 能力完成
