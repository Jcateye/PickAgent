export const activitySimulationResultRoutes = [
  { method: "GET", path: "/api/v1/activity-simulation-results", handler: "list" },
  { method: "GET", path: "/api/v1/activity-simulation-results/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/activity-simulation-results", handler: "create" },
  { method: "PATCH", path: "/api/v1/activity-simulation-results/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/activity-simulation-results/:id", handler: "remove" },
] as const;

// TODO: 将 activitySimulationResultRoutes 绑定到实际框架路由。
