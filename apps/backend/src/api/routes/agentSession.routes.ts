export const agentSessionRoutes = [
  { method: "GET", path: "/api/v1/agent-sessions", handler: "list" },
  { method: "GET", path: "/api/v1/agent-sessions/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-sessions", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-sessions/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-sessions/:id", handler: "remove" },
] as const;

// TODO: 将 agentSessionRoutes 绑定到实际框架路由。
