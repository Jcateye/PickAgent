export const skuHealthDiagnosisRoutes = [
  { method: "GET", path: "/api/v1/sku-health-diagnoses", handler: "list" },
  { method: "GET", path: "/api/v1/sku-health-diagnoses/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/sku-health-diagnoses", handler: "create" },
  { method: "PATCH", path: "/api/v1/sku-health-diagnoses/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/sku-health-diagnoses/:id", handler: "remove" },
] as const;

// TODO: 将 skuHealthDiagnosisRoutes 绑定到实际框架路由。
