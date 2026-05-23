export const agentToolCallRoutes = [
  { method: "GET", path: "/api/v1/agent-tool-calls", handler: "list" },
  { method: "GET", path: "/api/v1/agent-tool-calls/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-tool-calls", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-tool-calls/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-tool-calls/:id", handler: "remove" },
] as const;

// TODO: 将 agentToolCallRoutes 绑定到实际框架路由。
