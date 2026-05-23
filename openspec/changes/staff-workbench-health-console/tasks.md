## 1. Dashboard and connector contracts

- [x] 1.1 定义 Dashboard 总览卡片、风险摘要和最近运行摘要的前端 contract
- [x] 1.2 定义 Connectors 页面状态、最近采集摘要和边界说明的前端 contract

## 2. Health console surfaces

- [x] 2.1 实现 Dashboard 页面在 mock 数据下的完整展示
- [x] 2.2 实现 Connectors 页面在 mock 数据下的完整展示

## 3. SKU list and detail flow

- [x] 3.1 实现 SKU 健康列表页与状态标记展示
- [x] 3.2 实现 SKU 详情页的健康状态、问题摘要、证据摘要和下一步动作视图

## 4. Final query integration

- [x] 4.1 接入最近运行摘要与导航关系校验
- [ ] 4.2 在模块最后接入真实 summary、connector、sku 和 workflow 查询接口

## 5. Module readiness gate

- [x] 5.1 用 mock DTO fixture 校验 Dashboard、Connectors、SKU 列表、SKU 详情和最近运行摘要的完整路径
- [x] 5.2 校验页面不重算健康状态、数据质量分、当前状态或下一步动作，只消费服务端 projection / DTO
- [x] 5.3 标记真实查询接入依赖：仅当 `backend-business-foundation` 的 projection / query 能力完成后，4.2 才能进入“已完成，不阻塞”
