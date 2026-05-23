## 1. Page recognition and extraction foundation

- [x] 1.1 实现目标商品列表页识别规则与不可采集状态提示
- [x] 1.2 实现当前页字段提取与标准字段映射预览

## 2. Collection preview and run state

- [x] 2.1 在 side panel 中接入采集预览、记录数量和异常字段提示
- [x] 2.2 建立插件侧本地 run state，展示当前页、累计记录数和运行状态

## 3. Multi-page collection flow

- [x] 3.1 实现自动翻页或受控循环采集流程
- [x] 3.2 实现采集中断、失败提示和继续采集入口

## 4. Submission integration

- [x] 4.1 用 mock submit adapter 打通采集结果提交流程
- [x] 4.2 在模块最后接入真实 ingest API 并校验 payload 契约一致性

## 5. Module readiness gate

- [x] 5.1 用 fixture 校验页面识别、字段映射、异常字段、分页 run state 和 mock submit payload
- [x] 5.2 清理插件 mock 文案中的健康诊断、活动准入、补货建议、Review 决策等越界表达
- [x] 5.3 标记真实 ingest 接入依赖：仅当 `backend-business-foundation` 的 ingest / projection 能力完成后，4.2 才能进入“已完成，不阻塞”
