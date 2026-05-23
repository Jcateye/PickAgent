## 1. Readiness gates and contracts

- [x] 1.1 汇总 `backend-business-foundation` 和前五个业务模块的“已完成且不阻塞”准入条件
- [x] 1.2 汇总跨模块联调所需的关键 contract 与链路说明
- [x] 1.3 确认每个模块均提供 mock 闭环、冻结 contract、fixture、验证结果和真实接入依赖状态

## 2. Fixed integration chain execution

- [x] 2.1 按顺序执行后端业务基座 readiness 校验
- [x] 2.2 按顺序执行插件 → ingest / SKU 健康链路联调
- [x] 2.3 按顺序执行活动模拟 → Review / 报告链路联调
- [x] 2.4 按顺序执行员工工作台 ↔ Agent 工作台 ↔ 真实工具链路联调

## 3. Blocker tracking and regression

- [x] 3.1 记录跨模块阻塞问题、所属模块和回流状态
- [x] 3.2 对修复后的链路执行回归验证并更新状态

## 4. Final acceptance

- [x] 4.1 依据预定义主链路完成最终验收清单
- [x] 4.2 输出整体通过条件、遗留风险和交付结论
- [x] 4.3 输出中文验收结论，明确各需求是否“已完成，不阻塞”
