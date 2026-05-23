## Tasks

- [x] 1.1 对齐 L4 最小 route 清单和 DTO contract，冻结 request / response schema。
- [x] 1.2 实现 `IngestRepository` 事务组合 profile、snapshot、diagnosis、projection。
- [x] 1.3 绑定 `POST /api/ingest`、`GET /api/health/summary`、`GET /api/skus`、`GET /api/skus/:skuProfileId`。
- [x] 1.4 实现 `ActivityRepository`，持久化 rule set、simulation run、simulation result。
- [x] 1.5 绑定 `POST /api/activities/parse`、`POST /api/activities/:activityRuleSetId/simulations`。
- [x] 1.6 实现 `ReviewRepository`、`ReportRepository` 的最小持久化。
- [x] 1.7 绑定 `GET /api/reviews`、`POST /api/reviews/:reviewItemId/decision`、`POST /api/reports`。
- [x] 1.8 补 route / service / repository 测试，输出下游解锁清单。
