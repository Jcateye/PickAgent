## ADDED Requirements

### Requirement: Dashboard summary surface
员工工作台 MUST 提供 Dashboard 总览页，并 SHALL 展示监控范围、健康状态分布、数据质量摘要和最近运行摘要的统一入口。

#### Scenario: Render dashboard with mock or real summary
- **WHEN** 用户进入 Dashboard 页面
- **THEN** 系统展示总览卡片、风险摘要和最近运行入口，并且页面可由 mock 或真实 summary 数据驱动

#### Scenario: Keep dashboard focused on overview
- **WHEN** 用户在 Dashboard 查看状态
- **THEN** 页面只展示摘要与跳转入口，而不直接展开活动模拟或审批细节

### Requirement: Connector state visibility
员工工作台 MUST 提供 Connectors 页面，并 SHALL 展示插件或连接器的连接状态、最近一次采集摘要和当前可用边界。

#### Scenario: Show connector state
- **WHEN** 用户进入 Connectors 页面
- **THEN** 系统展示连接器状态、最近采集时间或摘要以及可用能力说明

#### Scenario: Connector page without control coupling
- **WHEN** 用户查看 Connectors 页面
- **THEN** 页面展示状态信息，但不直接承担插件自动化控制流程

### Requirement: SKU health list and detail
员工工作台 MUST 提供 SKU 健康列表与详情页，并 SHALL 支持从列表进入详情、查看健康状态、问题摘要和下一步动作。

#### Scenario: Browse SKU list
- **WHEN** 用户进入 SKU 健康列表页
- **THEN** 系统展示 SKU 列表、状态标记和可进入详情的对象入口

#### Scenario: View SKU detail
- **WHEN** 用户从列表打开某个 SKU 详情
- **THEN** 系统展示该 SKU 的健康状态、问题摘要、证据摘要和下一步动作

### Requirement: Final query integration
员工工作台 MUST 在模块最后阶段接入真实 summary、connector、sku 与 workflow 查询接口，并 SHALL 保持与 mock 阶段一致的页面 contract。

#### Scenario: Replace mock data adapters
- **WHEN** 模块进入真实联调阶段
- **THEN** 页面在不改变用户交互结构的前提下切换到真实查询接口

#### Scenario: Preserve navigation semantics after integration
- **WHEN** 真实接口接入完成
- **THEN** Dashboard、Connectors、SKU 列表和详情之间的导航与对象语义保持不变

### Requirement: Read-model consumption boundary
员工工作台健康模块 MUST 消费服务端 summary、projection 和 detail DTO，并 SHALL NOT 在前端重新计算健康状态、数据质量分、风险状态或下一步动作。

#### Scenario: Render server projection
- **WHEN** 页面收到 `CurrentSkuProjection` 或 SKU detail DTO
- **THEN** 页面直接展示服务端给出的状态、问题摘要、证据摘要和下一步动作

#### Scenario: Avoid frontend recalculation
- **WHEN** 页面同时获得 snapshot、diagnosis 或 projection 字段
- **THEN** 页面不自行拼装或推导 current state，而是以服务端 projection 为准
