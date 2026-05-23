export const agentMessageRoutes = [
  { method: "GET", path: "/api/v1/agent-messages", handler: "list" },
  { method: "GET", path: "/api/v1/agent-messages/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-messages", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-messages/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-messages/:id", handler: "remove" },
] as const;

// TODO: 将 agentMessageRoutes 绑定到实际框架路由。
