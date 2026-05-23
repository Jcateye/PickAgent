## 1. Rule authoring surface

- [ ] 1.1 定义活动规则录入区、原文区和结构化规则区的页面 contract
- [ ] 1.2 用 mock 规则与 mock 解析结果实现规则录入与展示闭环

## 2. Simulation result surface

- [ ] 2.1 实现按状态分组的模拟结果摘要视图
- [ ] 2.2 实现失败规则、证据摘要和修复建议的对象详情视图

## 3. What-if flow

- [ ] 3.1 定义 what-if 输入输出 contract
- [ ] 3.2 用 mock 数据实现 what-if 对比与差异展示

## 4. Final parse and simulation integration

- [ ] 4.1 在模块内部校验规则录入、结果查看和 what-if 的串行路径
- [ ] 4.2 在模块最后接入真实 rule parse 与 simulation 接口

## 5. Module readiness gate

- [ ] 5.1 用 mock DTO fixture 校验规则录入、结构化规则、模拟结果详情、失败原因、修复建议和 what-if 对比路径
- [ ] 5.2 校验页面不处理正式 Review 决策、不重算长期健康状态、不让活动准入状态覆盖健康状态
- [ ] 5.3 标记真实解析/模拟依赖：仅当 `backend-business-foundation` 的 Rule DSL / Simulation 能力完成后，4.2 才能进入“已完成，不阻塞”
