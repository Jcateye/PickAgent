export const agentContextSnapshotRoutes = [
  { method: "GET", path: "/api/v1/agent-context-snapshots", handler: "list" },
  { method: "GET", path: "/api/v1/agent-context-snapshots/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/agent-context-snapshots", handler: "create" },
  { method: "PATCH", path: "/api/v1/agent-context-snapshots/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/agent-context-snapshots/:id", handler: "remove" },
] as const;

// TODO: 将 agentContextSnapshotRoutes 绑定到实际框架路由。
