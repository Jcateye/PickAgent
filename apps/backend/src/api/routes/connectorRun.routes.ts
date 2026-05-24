export const connectorRunRoutes = [
  { method: "GET", path: "/api/v1/connector-runs", handler: "list" },
  { method: "GET", path: "/api/v1/connector-runs/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/connector-runs", handler: "create" },
  { method: "PATCH", path: "/api/v1/connector-runs/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/connector-runs/:id", handler: "remove" },
] as const;

// TODO: 将 connectorRunRoutes 绑定到实际框架路由。
