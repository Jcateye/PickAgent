export const agentContextLinkRoutes = [
  { method: "GET", path: "/api/v1/agent-context-links", handler: "list" },
  { method: "GET", path: "/api/v1/agent-context-links/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-context-links", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-context-links/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-context-links/:id", handler: "remove" },
] as const;

// TODO: 将 agentContextLinkRoutes 绑定到实际框架路由。
