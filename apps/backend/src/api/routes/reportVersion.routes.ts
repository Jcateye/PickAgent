export const reportVersionRoutes = [
  { method: "GET", path: "/api/v1/report-versions", handler: "list" },
  { method: "GET", path: "/api/v1/report-versions/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/report-versions", handler: "create" },
  { method: "PATCH", path: "/api/v1/report-versions/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/report-versions/:id", handler: "remove" },
] as const;

// TODO: 将 reportVersionRoutes 绑定到实际框架路由。
