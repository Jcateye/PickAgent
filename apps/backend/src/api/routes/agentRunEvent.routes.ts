export const agentRunEventRoutes = [
  { method: "GET", path: "/api/v1/agent-run-events", handler: "list" },
  { method: "GET", path: "/api/v1/agent-run-events/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-run-events", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-run-events/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-run-events/:id", handler: "remove" },
] as const;

// TODO: 将 agentRunEventRoutes 绑定到实际框架路由。
