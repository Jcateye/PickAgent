export const workspaceSettingRoutes = [
  { method: "GET", path: "/api/v1/workspace-settings", handler: "list" },
  { method: "GET", path: "/api/v1/workspace-settings/:id", handler: "detail" },
  { method: "POST", path: "/api/v1/workspace-settings", handler: "create" },
  { method: "PATCH", path: "/api/v1/workspace-settings/:id", handler: "update" },
  { method: "DELETE", path: "/api/v1/workspace-settings/:id", handler: "remove" },
] as const;

// TODO: 将 workspaceSettingRoutes 绑定到实际框架路由。
