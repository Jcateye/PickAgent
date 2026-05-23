# Changelog

> 记录对外有感知或对团队协作有影响的重要变更。当前项目尚未进入功能开发阶段，先记录已确认的架构与文档基线。

## 记录格式

### [YYYY-MM-DD] 标题

- 模块：
- 类型：[功能 / 修复 / 契约 / 数据 / 发布 / 架构 / 文档]
- 摘要：
- 影响范围：
- 是否影响 contracts：[是 / 否]
- 是否影响数据结构：[是 / 否]
- 兼容性说明：
- 关联任务 / 决策：

---

### [2026-05-23] 确认 SKU Ready Agent 的 P0 架构基线

- 模块：architecture / docs / apps
- 类型：架构
- 摘要：确认浏览器插件 + 集中式总控制台双客户端结构，确定服务拆分、数据主语、Rule DSL、Review 与 current projection 边界。
- 影响范围：`docs/PRD.md`、`docs/architecture.md`、`claude_prd_report.html`、`apps/*/README.md`
- 是否影响 contracts：是
- 是否影响数据结构：是
- 兼容性说明：当前为开发前架构定稿，不涉及已发布运行时兼容问题
- 关联任务 / 决策：ADR-001 ~ ADR-006

---

### [2026-05-23] 新增 apps/extension 插件工程占位并重写项目说明文档

- 模块：apps / docs / root
- 类型：文档
- 摘要：新增 `apps/extension/` 作为 Plasmo 插件落点，并将通用占位文档改写为 SKU Ready Agent 项目化说明。
- 影响范围：`README.md`、`docs/*.md`、`apps/*/README.md`
- 是否影响 contracts：否
- 是否影响数据结构：否
- 兼容性说明：仅文档与目录结构层变更，不影响运行时
- 关联任务 / 决策：ADR-001
