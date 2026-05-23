# PickAgent Extension

`apps/extension/` 承载 SKU Ready Agent 的浏览器插件（Plasmo）。

## 目标

作为系统的数据入口，在商品列表页中扫描 SKU 数据并提交到服务端 ingest。

## 当前职责

- 识别支持的平台页面与页面类型
- 扫描商品列表 table / list
- 做字段映射预览
- 展示采集层风险与数据质量预估
- 提交 `/api/ingest`
- 成功后引导用户跳转总控制台

## 不负责

- 健康诊断
- 规则解析
- 活动准入模拟
- Review 决策
- 报告生成

## 建议 UI 结构

- popup：轻入口，只放状态与跳转
- side panel：主工作区，承载扫描、预览、风险提示、提交

## 建议目录

```txt
apps/extension/
  entrypoints/
    popup/
    side-panel/
    content-script/
  lib/
    extractor/
    adapter/
    mapping/
    api/
  schemas/
```

## 当前状态

- 工程目录已预留
- 详细 UI 线框与边界已在 `claude_prd_report.html` 中确认
- 代码骨架尚未正式初始化
