export const workflowRunRoutes = [
  { method: "GET", path: "/api/v1/workflow-runs", handler: "list" },
  { method: "GET", path: "/api/v1/workflow-runs/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/workflow-runs", handler: "create" },
  { method: "PATCH", path: "/api/v1/workflow-runs/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/workflow-runs/:id", handler: "remove" },
] as const;

// TODO: 将 workflowRunRoutes 绑定到实际框架路由。
