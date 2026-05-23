export const agentMissionRoutes = [
  { method: "GET", path: "/api/v1/agent-missions", handler: "list" },
  { method: "GET", path: "/api/v1/agent-missions/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-missions", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-missions/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-missions/:id", handler: "remove" },
] as const;

// TODO: 将 agentMissionRoutes 绑定到实际框架路由。
