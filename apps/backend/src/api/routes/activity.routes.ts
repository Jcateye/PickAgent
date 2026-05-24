export const activityRoutes = [
  { method: "GET", path: "/api/v1/activities", handler: "list" },
  { method: "GET", path: "/api/v1/activities/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/activities", handler: "create" },
  { method: "PATCH", path: "/api/v1/activities/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/activities/:id", handler: "remove" },
] as const;

// TODO: 将 activityRoutes 绑定到实际框架路由。
