## Tasks

- [ ] 2.1 定义 `AgentEventStore.append/listAfter/markRunStatus/linkWorkflowStep` 接口。
- [ ] 2.2 实现 `AgentRepository` 对 `AgentSession`、`AgentMission`、`AgentRun`、`AgentRunEvent`、`AgentToolCall`、`AgentReviewGate` 的最小访问。
- [ ] 2.3 绑定 `POST /api/agent/missions`、`POST /api/agent/missions/:missionId/runs`、`GET /api/agent/runs/:runId/events`。
- [ ] 2.4 实现 `AgentToolExecutor`，统一输出 permission、riskLevel、reviewPolicy、evidenceRefs。
- [ ] 2.5 绑定 `POST /api/agent/review-gates/:gateId/decision`，默认创建 continuation run。
- [ ] 2.6 验证未注册工具、`coding`、`file`、`bash`、direct SQL、credential access 均不可用。
