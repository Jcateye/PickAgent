export const ruleSetVersionRoutes = [
  { method: "GET", path: "/api/v1/rule-set-versions", handler: "list" },
  { method: "GET", path: "/api/v1/rule-set-versions/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/rule-set-versions", handler: "create" },
  { method: "PATCH", path: "/api/v1/rule-set-versions/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/rule-set-versions/:id", handler: "remove" },
] as const;

// TODO: 将 ruleSetVersionRoutes 绑定到实际框架路由。
