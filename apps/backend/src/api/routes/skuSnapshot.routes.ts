export const skuSnapshotRoutes = [
  { method: "GET", path: "/api/v1/sku-snapshots", handler: "list" },
  { method: "GET", path: "/api/v1/sku-snapshots/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/sku-snapshots", handler: "create" },
  { method: "PATCH", path: "/api/v1/sku-snapshots/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/sku-snapshots/:id", handler: "remove" },
] as const;

// TODO: 将 skuSnapshotRoutes 绑定到实际框架路由。
