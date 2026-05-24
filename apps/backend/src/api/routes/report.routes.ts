export const reportRoutes = [
  { method: "GET", path: "/api/v1/reports", handler: "list" },
  { method: "GET", path: "/api/v1/reports/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/reports", handler: "create" },
  { method: "PATCH", path: "/api/v1/reports/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/reports/:id", handler: "remove" },
] as const;

// TODO: 将 reportRoutes 绑定到实际框架路由。
