export const workflowStepRoutes = [
  { method: "GET", path: "/api/v1/workflow-steps", handler: "list" },
  { method: "GET", path: "/api/v1/workflow-steps/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/workflow-steps", handler: "create" },
  { method: "PATCH", path: "/api/v1/workflow-steps/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/workflow-steps/:id", handler: "remove" },
] as const;

// TODO: 将 workflowStepRoutes 绑定到实际框架路由。
