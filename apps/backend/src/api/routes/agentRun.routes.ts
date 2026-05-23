export const agentRunRoutes = [
  { method: "GET", path: "/api/v1/agent-runs", handler: "list" },
  { method: "GET", path: "/api/v1/agent-runs/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-runs", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-runs/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-runs/:id", handler: "remove" },
] as const;

// TODO: 将 agentRunRoutes 绑定到实际框架路由。
