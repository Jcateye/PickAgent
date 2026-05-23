export const activitySimulationRunRoutes = [
  { method: "GET", path: "/api/v1/activity-simulation-runs", handler: "list" },
  { method: "GET", path: "/api/v1/activity-simulation-runs/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/activity-simulation-runs", handler: "create" },
  { method: "PATCH", path: "/api/v1/activity-simulation-runs/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/activity-simulation-runs/:id", handler: "remove" },
] as const;

// TODO: 将 activitySimulationRunRoutes 绑定到实际框架路由。
