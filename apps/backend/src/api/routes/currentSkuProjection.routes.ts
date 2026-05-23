export const currentSkuProjectionRoutes = [
  { method: "GET", path: "/api/v1/current-sku-projections", handler: "list" },
  { method: "GET", path: "/api/v1/current-sku-projections/:skuProfileId", handler: "detail" },
  { method: "POST", path: "/api/v1/current-sku-projections", handler: "create" },
  { method: "PATCH", path: "/api/v1/current-sku-projections/:skuProfileId", handler: "update" },
  { method: "DELETE", path: "/api/v1/current-sku-projections/:skuProfileId", handler: "remove" },
] as const;

// TODO: 将 currentSkuProjectionRoutes 绑定到实际框架路由。
