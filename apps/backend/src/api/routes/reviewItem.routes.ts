export const reviewItemRoutes = [
  { method: "GET", path: "/api/v1/review-items", handler: "list" },
  { method: "GET", path: "/api/v1/review-items/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/review-items", handler: "create" },
  { method: "PATCH", path: "/api/v1/review-items/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/review-items/:id", handler: "remove" },
] as const;

// TODO: 将 reviewItemRoutes 绑定到实际框架路由。
