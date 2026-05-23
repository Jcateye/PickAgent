export const connectorRoutes = [
  { method: "GET", path: "/api/v1/connectors", handler: "list" },
  { method: "GET", path: "/api/v1/connectors/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/connectors", handler: "create" },
  { method: "PATCH", path: "/api/v1/connectors/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/connectors/:id", handler: "remove" },
] as const;

// TODO: 将 connectorRoutes 绑定到实际框架路由。
