export const activityRuleSetRoutes = [
  { method: "GET", path: "/api/v1/activity-rule-sets", handler: "list" },
  { method: "GET", path: "/api/v1/activity-rule-sets/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/activity-rule-sets", handler: "create" },
  { method: "PATCH", path: "/api/v1/activity-rule-sets/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/activity-rule-sets/:id", handler: "remove" },
] as const;

// TODO: 将 activityRuleSetRoutes 绑定到实际框架路由。
