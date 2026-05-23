## 1. Review workbench structure

- [x] 1.1 定义 Review 列表页的字段、筛选和状态展示 contract
- [x] 1.2 用 mock Review 数据实现列表、详情和对象导航闭环

## 2. Decision flow

- [x] 2.1 实现 Review 详情中的问题、建议、风险和证据摘要区
- [x] 2.2 实现批准、驳回和修改动作的交互与状态反馈

## 3. Reporting surface

- [x] 3.1 定义报告预览页章节结构与输出状态 contract
- [x] 3.2 用 mock 报告数据实现报告预览与导出占位

## 4. Final review and report integration

- [x] 4.1 校验 Review 与报告模块内部串行工作流
- [ ] 4.2 在模块最后接入真实 review 与 report 接口
  - Layer 1 不实现真实 ReviewService / ReportService；该项等待 `backend-business-foundation` 后再进入联调。

## 5. Module readiness gate

- [x] 5.1 用 mock DTO fixture 校验 Review 列表、筛选、详情、决策动作、报告预览和输出状态
- [x] 5.2 校验模块不重新生成活动模拟、不重新解释 Agent run，只消费 Review / Report DTO 与来源对象
- [x] 5.3 标记真实 Review/Report 依赖：仅当 `backend-business-foundation` 的 ReviewService / ReportService 完成后，4.2 才能进入“已完成，不阻塞”
