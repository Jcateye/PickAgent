export const skuProfileRoutes = [
  { method: "GET", path: "/api/v1/sku-profiles", handler: "list" },
  { method: "GET", path: "/api/v1/sku-profiles/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/sku-profiles", handler: "create" },
  { method: "PATCH", path: "/api/v1/sku-profiles/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/sku-profiles/:id", handler: "remove" },
] as const;

// TODO: 将 skuProfileRoutes 绑定到实际框架路由。
