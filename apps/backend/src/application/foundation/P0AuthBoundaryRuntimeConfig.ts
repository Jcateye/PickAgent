export type RuntimeMode = "development" | "test" | "production";

export interface P0AuthContextDto {
  actorId: string;
  tenantId: string;
  sessionId: string;
  surface: string;
  requestId: string;
}

export interface P0RuntimeConfig {
  mode: RuntimeMode;
  allowDevAuthFallback: boolean;
  productionToolAllowlist: readonly string[];
  runtimeToolDenylist: readonly string[];
}

export interface P0GuardRequest {
  headers?: Record<string, string | string[] | undefined>;
  actorId?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
  surface?: string | null;
  requestId?: string | null;
}

declare const process: { env: Record<string, string | undefined> };

export class P0AuthBoundaryError extends Error {
  constructor(
    message: string,
    readonly code: "P0_AUTH_BOUNDARY_MISSING" | "P0_TENANT_BOUNDARY_DENIED" | "P0_RUNTIME_CONFIG_INVALID",
    readonly audit: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const P0_PRODUCTION_TOOL_ALLOWLIST = ["parseActivityRules", "simulateActivityReadiness", "explainDecisionWithEvidence"] as const;

export const P0_RUNTIME_TOOL_DENYLIST = ["coding", "file", "bash", "sql", "credential", "cookie", "token", "jwt", "sso", "secret", "api key"] as const;

export function createP0RuntimeConfig(env: Record<string, string | undefined> = process.env): P0RuntimeConfig {
  const mode = normalizeMode(env.NODE_ENV);
  const allowDevAuthFallback = parseBoolean(env.P0_ALLOW_DEV_AUTH_FALLBACK);
  if (mode === "production" && allowDevAuthFallback) {
    throw new P0AuthBoundaryError("production cannot enable P0_ALLOW_DEV_AUTH_FALLBACK", "P0_RUNTIME_CONFIG_INVALID", { mode });
  }
  return {
    mode,
    allowDevAuthFallback,
    productionToolAllowlist: P0_PRODUCTION_TOOL_ALLOWLIST,
    runtimeToolDenylist: P0_RUNTIME_TOOL_DENYLIST,
  };
}

export function requireP0AuthContext(request: P0GuardRequest, config: P0RuntimeConfig): P0AuthContextDto {
  const headers = request.headers ?? {};
  const context: P0AuthContextDto = {
    actorId: first(request.actorId, header(headers, "x-p0-actor-id")),
    tenantId: first(request.tenantId, header(headers, "x-p0-tenant-id")),
    sessionId: first(request.sessionId, header(headers, "x-p0-session-id")),
    surface: first(request.surface, header(headers, "x-p0-surface"), "api"),
    requestId: first(request.requestId, header(headers, "x-request-id"), "request_unknown"),
  };
  const missing = (["actorId", "tenantId", "sessionId"] as const).filter((key) => !context[key]);
  if (!missing.length) return context;
  if (config.mode !== "production" && config.allowDevAuthFallback) {
    return {
      actorId: context.actorId || "dev_actor",
      tenantId: context.tenantId || "dev_tenant",
      sessionId: context.sessionId || "dev_session",
      surface: context.surface,
      requestId: context.requestId,
    };
  }
  throw new P0AuthBoundaryError("actor, tenant and session context are required", "P0_AUTH_BOUNDARY_MISSING", {
    requestId: context.requestId,
    surface: context.surface,
    missing,
    mode: config.mode,
  });
}

export function assertTenantBoundary(context: P0AuthContextDto, ownerTenantId: string | null | undefined, entityId: string): void {
  if (!ownerTenantId || ownerTenantId === context.tenantId) return;
  throw new P0AuthBoundaryError("cross-tenant access denied", "P0_TENANT_BOUNDARY_DENIED", {
    requestId: context.requestId,
    actorId: context.actorId,
    tenantId: context.tenantId,
    ownerTenantId,
    entityId,
  });
}

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, isSensitiveKey(key) ? "[REDACTED]" : redactSensitiveValue(item)]),
  );
}

export function redactSensitiveText(value: string): string {
  return value.replace(/(credential|cookie|token|jwt|sso|secret|api\s*key|api[_-]?key)([=:]\s*)?[^;\s,]*/gi, "$1[REDACTED]");
}

function normalizeMode(value: string | undefined): RuntimeMode {
  if (value === "production") return "production";
  if (value === "test") return "test";
  return "development";
}

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE";
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function first(...values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function isSensitiveKey(key: string): boolean {
  return /(credential|cookie|token|jwt|sso|secret|api[_-]?key|apikey|password|authorization)/i.test(key);
}
