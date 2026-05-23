export const agentReviewGateRoutes = [
  { method: "GET", path: "/api/v1/agent-review-gates", handler: "list" },
  { method: "GET", path: "/api/v1/agent-review-gates/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-review-gates", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-review-gates/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-review-gates/:id", handler: "remove" },
] as const;

// TODO: 将 agentReviewGateRoutes 绑定到实际框架路由。
